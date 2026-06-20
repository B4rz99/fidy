import { and, between, desc, eq, sql, sum } from "drizzle-orm";
import { getActiveTransactionConditions } from "@/features/transactions/query.public";
import type { AnyDb } from "@/shared/db/client";
import { transactions } from "@/shared/db/schema";
import { parseIsoDate } from "@/shared/lib";
import type { CategoryId, CopAmount, IsoDate, TransactionId, UserId } from "@/shared/types/branded";
import type { CategoryExpenseItem } from "./derive";

export type AnalyticsPeriodQuery = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
};

export function getIncomeExpenseForPeriod(query: AnalyticsPeriodQuery): {
  income: CopAmount;
  expenses: CopAmount;
} {
  const { db, endDate, startDate, userId } = query;

  const row = db
    .select({
      income: sql<number>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END)`,
      expenses: sql<number>`SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END)`,
    })
    .from(transactions)
    .where(
      and(...getActiveTransactionConditions(userId), between(transactions.date, startDate, endDate))
    )
    .get();
  return {
    income: (row?.income ?? 0) as CopAmount,
    expenses: (row?.expenses ?? 0) as CopAmount,
  };
}

export function getSpendingByCategoryForPeriod(
  query: AnalyticsPeriodQuery
): readonly { categoryId: CategoryId; total: CopAmount }[] {
  const { db, endDate, startDate, userId } = query;

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
        between(transactions.date, startDate, endDate)
      )
    )
    .groupBy(transactions.categoryId)
    .orderBy(desc(sum(transactions.amount)))
    .all();
}

export function getExpenseTransactionsForPeriod(
  query: AnalyticsPeriodQuery
): readonly CategoryExpenseItem[] {
  const { db, endDate, startDate, userId } = query;

  return db
    .select({
      id: transactions.id,
      categoryId: transactions.categoryId,
      amount: transactions.amount,
      description: transactions.description,
      date: transactions.date,
    })
    .from(transactions)
    .where(
      and(
        ...getActiveTransactionConditions(userId),
        eq(transactions.type, "expense"),
        between(transactions.date, startDate, endDate)
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .all()
    .map((row) => ({
      id: row.id as TransactionId,
      categoryId: row.categoryId,
      amount: row.amount,
      description: row.description,
      date: parseIsoDate(row.date),
    }));
}
