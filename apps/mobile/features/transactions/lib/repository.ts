import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { syncMeta, syncQueue, transactions } from "@/shared/db/schema";
import { toStoredTransaction } from "./build-transaction";
import type { StoredTransaction } from "../schema";

export type SyncOperation = "insert" | "update" | "delete";
export type SyncTableName = "transactions";

export type TransactionRow = typeof transactions.$inferInsert;

export function insertTransaction(db: AnyDb, row: TransactionRow) {
  db.insert(transactions).values(row).run();
}

export function getAllTransactions(db: AnyDb, userId: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date))
    .all();
}

export function softDeleteTransaction(db: AnyDb, id: string, now: string) {
  db.update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(transactions.id, id))
    .run();
}

export function getTransactionById(db: AnyDb, id: string) {
  const rows = db.select().from(transactions).where(eq(transactions.id, id)).all();
  return rows[0] ?? null;
}

export function upsertTransaction(db: AnyDb, row: TransactionRow) {
  db.insert(transactions)
    .values(row)
    .onConflictDoUpdate({
      target: transactions.id,
      set: {
        type: row.type,
        amountCents: row.amountCents,
        categoryId: row.categoryId,
        description: row.description,
        date: row.date,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export type SyncQueueEntry = {
  id: string;
  tableName: SyncTableName;
  rowId: string;
  operation: SyncOperation;
  createdAt: string;
};

export function enqueueSync(db: AnyDb, entry: SyncQueueEntry) {
  db.insert(syncQueue).values(entry).run();
}

export function getQueuedSyncEntries(db: AnyDb) {
  return db.select().from(syncQueue).all();
}

export function clearSyncEntries(db: AnyDb, ids: string[]) {
  if (ids.length === 0) return;
  db.delete(syncQueue).where(inArray(syncQueue.id, ids)).run();
}

export function getSyncMeta(db: AnyDb, key: string) {
  const rows = db.select().from(syncMeta).where(eq(syncMeta.key, key)).all();
  return rows[0]?.value ?? null;
}

export function setSyncMeta(db: AnyDb, key: string, value: string) {
  db.insert(syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value } })
    .run();
}

// --- Paginated repository functions ---

export function getBalance(db: AnyDb, userId: string): number {
  const rows = db
    .select({
      balance: sql<number>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amountCents} ELSE -${transactions.amountCents} END)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .all();
  return Number(rows[0]?.balance) || 0;
}

export function getCategorySpending(
  db: AnyDb,
  userId: string,
  monthStart: string,
  monthEnd: string
): { categoryId: string; totalCents: number }[] {
  return db
    .select({
      categoryId: transactions.categoryId,
      totalCents: sql<number>`CAST(SUM(${transactions.amountCents}) AS INTEGER)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        isNull(transactions.deletedAt),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd)
      )
    )
    .groupBy(transactions.categoryId)
    .orderBy(desc(sql`SUM(${transactions.amountCents})`))
    .all();
}

export function getDailySpending(
  db: AnyDb,
  userId: string,
  startDate: string,
  endDate: string
): { date: string; totalCents: number }[] {
  return db
    .select({
      date: transactions.date,
      totalCents: sql<number>`CAST(SUM(${transactions.amountCents}) AS INTEGER)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        isNull(transactions.deletedAt),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(transactions.date)
    .orderBy(transactions.date)
    .all();
}

export type TransactionCursor = {
  readonly date: string;
  readonly createdAt: string;
  readonly id: string;
} | null;

export function getTransactionPage(
  db: AnyDb,
  userId: string,
  cursor: TransactionCursor,
  limit: number
): StoredTransaction[] {
  const baseConditions = and(
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt)
  );

  const cursorCondition = cursor
    ? or(
        lt(transactions.date, cursor.date),
        and(eq(transactions.date, cursor.date), lt(transactions.createdAt, cursor.createdAt)),
        and(
          eq(transactions.date, cursor.date),
          eq(transactions.createdAt, cursor.createdAt),
          lt(transactions.id, cursor.id)
        )
      )
    : undefined;

  const whereClause = cursorCondition
    ? and(baseConditions, cursorCondition)
    : baseConditions;

  const rows = db
    .select()
    .from(transactions)
    .where(whereClause)
    .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
    .limit(limit)
    .all();

  return rows.map(toStoredTransaction);
}
