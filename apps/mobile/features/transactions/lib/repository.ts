import { and, between, desc, eq, inArray, isNull, like, or, sql, sum } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { syncMeta, syncQueue, transactions } from "@/shared/db";
import type {
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  Month,
  SyncQueueId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type { SyncOperation, SyncQueueEntry, SyncTableName } from "@/shared/db";

export type TransactionRow = typeof transactions.$inferInsert;

export function insertTransaction(db: AnyDb, row: TransactionRow) {
  db.insert(transactions).values(row).run();
}

export function getAllTransactions(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date))
    .all();
}

export function getTransactionsPaginated(db: AnyDb, userId: UserId, limit: number, offset: number) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit + 1)
    .offset(offset)
    .all();
}

export function getBalanceAggregate(db: AnyDb, userId: UserId): CopAmount {
  const row = db
    .select({
      balance: sql<number>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE -${transactions.amount} END)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .get();
  return (row?.balance ?? 0) as CopAmount;
}

export function getSpendingByCategoryAggregate(
  db: AnyDb,
  userId: UserId,
  month: Month
): Array<{ categoryId: CategoryId; total: CopAmount }> {
  return db
    .select({
      categoryId: transactions.categoryId,
      total: sum(transactions.amount).mapWith((val) => Number(val) as CopAmount),
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
    .orderBy(desc(sum(transactions.amount)))
    .all();
}

export function getDailySpendingAggregate(
  db: AnyDb,
  userId: UserId,
  startDate: IsoDate,
  endDate: IsoDate
): Array<{ date: IsoDate; total: CopAmount }> {
  return db
    .select({
      date: transactions.date,
      total: sum(transactions.amount).mapWith((val) => Number(val) as CopAmount),
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

/** Get monthly income/expense totals for projection calculations. */
export function getMonthlyTotalsByType(
  db: AnyDb,
  userId: UserId,
  months: number
): Array<{ month: string; type: string; total: number }> {
  // Compute cutoff: first day of the oldest month in the window.
  // With months=3 in March 2026 we want Jan, Feb, Mar → cutoff = 2026-01.
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;

  return db
    .select({
      month: sql<string>`strftime('%Y-%m', ${transactions.date})`,
      type: transactions.type,
      total: sum(transactions.amount).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        sql`strftime('%Y-%m', ${transactions.date}) >= ${cutoffStr}`
      )
    )
    .groupBy(sql`strftime('%Y-%m', ${transactions.date})`, transactions.type)
    .orderBy(desc(sql`strftime('%Y-%m', ${transactions.date})`))
    .all();
}

export function getRecentTransactions(
  db: AnyDb,
  userId: UserId,
  currentMonth: Month,
  previousMonth: Month
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

export function softDeleteTransaction(db: AnyDb, id: TransactionId, now: IsoDateTime) {
  db.update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(transactions.id, id))
    .run();
}

export function getTransactionById(db: AnyDb, id: TransactionId) {
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
        amount: row.amount,
        categoryId: row.categoryId,
        description: row.description,
        date: row.date,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export { enqueueSync } from "@/shared/db";

export function getQueuedSyncEntries(db: AnyDb) {
  return db.select().from(syncQueue).all();
}

export function clearSyncEntries(db: AnyDb, ids: SyncQueueId[]) {
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
