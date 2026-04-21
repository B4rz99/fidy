import { and, between, desc, eq, inArray, like, or, sql, sum } from "drizzle-orm";
import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/lib/default-account";
import type { AnyDb } from "@/shared/db/client";
import { syncMeta, syncQueue, transactions } from "@/shared/db/schema";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  Month,
  SyncQueueId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import type { AccountAttributionState } from "../schema";
import { getActiveTransactionConditions } from "./active-transaction-conditions";
import { getDefaultAccountAttributionState } from "./build-transaction";

export type { SyncOperation, SyncQueueEntry, SyncTableName } from "@/shared/db";

type PersistedTransactionRow = typeof transactions.$inferInsert;
type TransactionsPageInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly limit: number;
  readonly offset: number;
};
type DailySpendingAggregateInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
};
type RecentTransactionsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly currentMonth: Month;
  readonly previousMonth: Month;
};

export type TransactionRow = Omit<
  PersistedTransactionRow,
  "accountId" | "accountAttributionState" | "supersededAt"
> & {
  accountId?: FinancialAccountId;
  accountAttributionState?: AccountAttributionState | string;
  supersededAt?: IsoDateTime | null;
};

function resolveTransactionSource(row: TransactionRow): string {
  return row.source ?? "manual";
}

function resolveTransactionAccountId(row: TransactionRow): FinancialAccountId {
  return row.accountId ?? buildDefaultFinancialAccountId(row.userId);
}

function resolveTransactionAttributionState(
  row: TransactionRow,
  source: string
): AccountAttributionState | string {
  return row.accountAttributionState ?? getDefaultAccountAttributionState(source);
}

function normalizeTransactionRow(row: TransactionRow): PersistedTransactionRow {
  const source = resolveTransactionSource(row);
  return {
    ...row,
    source,
    accountId: resolveTransactionAccountId(row),
    accountAttributionState: resolveTransactionAttributionState(row, source),
    supersededAt: row.supersededAt ?? null,
  };
}

export function insertTransaction(db: AnyDb, row: TransactionRow) {
  db.insert(transactions).values(normalizeTransactionRow(row)).run();
}

export function getAllTransactions(db: AnyDb, userId: UserId): TransactionRow[] {
  return db
    .select()
    .from(transactions)
    .where(and(...getActiveTransactionConditions(userId)))
    .orderBy(desc(transactions.date))
    .all() as TransactionRow[];
}

export function getTransactionsPaginated(input: TransactionsPageInput): TransactionRow[] {
  return input.db
    .select()
    .from(transactions)
    .where(and(...getActiveTransactionConditions(input.userId)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(input.limit + 1)
    .offset(input.offset)
    .all() as TransactionRow[];
}

export function getBalanceAggregate(db: AnyDb, userId: UserId): CopAmount {
  const row = db
    .select({
      balance: sql<number>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE -${transactions.amount} END)`,
    })
    .from(transactions)
    .where(and(...getActiveTransactionConditions(userId)))
    .get();
  return (row?.balance ?? 0) as CopAmount;
}

export function getSpendingByCategoryAggregate(
  db: AnyDb,
  userId: UserId,
  month: Month
): { categoryId: CategoryId; total: CopAmount }[] {
  return db
    .select({
      categoryId: transactions.categoryId,
      total: sum(transactions.amount).mapWith((val) => Number(val) as CopAmount),
    })
    .from(transactions)
    .where(
      and(
        ...getActiveTransactionConditions(userId),
        eq(transactions.type, "expense"),
        like(transactions.date, `${month}%`)
      )
    )
    .groupBy(transactions.categoryId)
    .orderBy(desc(sum(transactions.amount)))
    .all();
}

export function getDailySpendingAggregate(
  input: DailySpendingAggregateInput
): { date: IsoDate; total: CopAmount }[] {
  return input.db
    .select({
      date: transactions.date,
      total: sum(transactions.amount).mapWith((val) => Number(val) as CopAmount),
    })
    .from(transactions)
    .where(
      and(
        ...getActiveTransactionConditions(input.userId),
        eq(transactions.type, "expense"),
        between(transactions.date, input.startDate, input.endDate)
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
): { month: string; type: string; total: number }[] {
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
        ...getActiveTransactionConditions(userId),
        sql`strftime('%Y-%m', ${transactions.date}) >= ${cutoffStr}`
      )
    )
    .groupBy(sql`strftime('%Y-%m', ${transactions.date})`, transactions.type)
    .orderBy(desc(sql`strftime('%Y-%m', ${transactions.date})`))
    .all();
}

export function getRecentTransactions(input: RecentTransactionsInput): TransactionRow[] {
  return input.db
    .select()
    .from(transactions)
    .where(
      and(
        ...getActiveTransactionConditions(input.userId),
        or(
          like(transactions.date, `${input.currentMonth}%`),
          like(transactions.date, `${input.previousMonth}%`)
        )
      )
    )
    .orderBy(desc(transactions.date))
    .all() as TransactionRow[];
}

export function softDeleteTransaction(db: AnyDb, id: TransactionId, now: IsoDateTime) {
  db.update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(transactions.id, id))
    .run();
}

export function getTransactionById(db: AnyDb, id: TransactionId): TransactionRow | null {
  const rows = db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .all() as TransactionRow[];
  return rows[0] ?? null;
}

export function upsertTransaction(db: AnyDb, row: TransactionRow) {
  const normalizedRow = normalizeTransactionRow(row);
  db.insert(transactions)
    .values(normalizedRow)
    .onConflictDoUpdate({
      target: transactions.id,
      set: {
        type: normalizedRow.type,
        amount: normalizedRow.amount,
        categoryId: normalizedRow.categoryId,
        description: normalizedRow.description,
        date: normalizedRow.date,
        accountId: normalizedRow.accountId,
        accountAttributionState: normalizedRow.accountAttributionState,
        supersededAt: normalizedRow.supersededAt,
        updatedAt: normalizedRow.updatedAt,
        deletedAt: normalizedRow.deletedAt,
      },
    })
    .run();
}

export { enqueueSync } from "@/shared/db/enqueue-sync";

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
