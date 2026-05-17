import { and, between, desc, eq, like, or, sql, sum } from "drizzle-orm";
import type { TransactionStorageWriteRow } from "@/infrastructure/local-ledger/transaction-storage";
import type { AnyDb } from "@/shared/db/client";
import { transactions } from "@/shared/db/schema";
import type {
  CategoryId,
  CopAmount,
  IsoDate,
  Month,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import { getActiveTransactionConditions } from "./active-transaction-conditions";

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
type SpendingByCategoryDateRangeInput = DailySpendingAggregateInput;
type RecentTransactionsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly currentMonth: Month;
  readonly previousMonth: Month;
};

export type TransactionRow = TransactionStorageWriteRow;

export function getAllTransactions(db: AnyDb, userId: UserId): TransactionRow[] {
  return db
    .select()
    .from(transactions)
    .where(and(...getActiveTransactionConditions(userId)))
    .orderBy(desc(transactions.date))
    .all();
}

export function getTransactionsPaginated(input: TransactionsPageInput): TransactionRow[] {
  return input.db
    .select()
    .from(transactions)
    .where(and(...getActiveTransactionConditions(input.userId)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(input.limit + 1)
    .offset(input.offset)
    .all();
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

export function getSpendingByCategoryDateRangeAggregate(
  input: SpendingByCategoryDateRangeInput
): { categoryId: CategoryId; total: CopAmount }[] {
  return input.db
    .select({
      categoryId: transactions.categoryId,
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
    .all();
}

export function getTransactionById(db: AnyDb, id: TransactionId): TransactionRow | null {
  const rows = db.select().from(transactions).where(eq(transactions.id, id)).all();
  return rows[0] ?? null;
}
