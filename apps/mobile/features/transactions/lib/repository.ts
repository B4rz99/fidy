import { and, between, desc, eq, inArray, isNull, like, or, sql, sum } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { syncMeta, syncQueue, transactions } from "@/shared/db/schema";

export type { SyncOperation, SyncQueueEntry, SyncTableName } from "@/shared/db/enqueue-sync";

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

export function getTransactionsPaginated(db: AnyDb, userId: string, limit: number, offset: number) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit + 1)
    .offset(offset)
    .all();
}

export function getBalanceAggregate(db: AnyDb, userId: string): number {
  const row = db
    .select({
      balance: sql<number>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amountCents} ELSE -${transactions.amountCents} END)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .get();
  return row?.balance ?? 0;
}

export function getSpendingByCategoryAggregate(
  db: AnyDb,
  userId: string,
  month: string
): Array<{ categoryId: string; totalCents: number }> {
  return db
    .select({
      categoryId: transactions.categoryId,
      totalCents: sum(transactions.amountCents).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        isNull(transactions.deletedAt),
        like(transactions.date, `${month}%`)
      )
    )
    .groupBy(transactions.categoryId)
    .all();
}

export function getDailySpendingAggregate(
  db: AnyDb,
  userId: string,
  startDate: string,
  endDate: string
): Array<{ date: string; totalCents: number }> {
  return db
    .select({
      date: transactions.date,
      totalCents: sum(transactions.amountCents).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        isNull(transactions.deletedAt),
        between(transactions.date, startDate, endDate)
      )
    )
    .groupBy(transactions.date)
    .all();
}

export function getRecentTransactions(
  db: AnyDb,
  userId: string,
  currentMonth: string,
  previousMonth: string
) {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        or(
          like(transactions.date, `${currentMonth}%`),
          like(transactions.date, `${previousMonth}%`)
        )
      )
    )
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

export { enqueueSync } from "@/shared/db/enqueue-sync";

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
