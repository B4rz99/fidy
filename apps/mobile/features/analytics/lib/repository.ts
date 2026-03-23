import { and, between, desc, eq, isNull, sql, sum } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { transactions } from "@/shared/db";
import type { CategoryId, CopAmount, IsoDate, UserId } from "@/shared/types/branded";

export function getIncomeExpenseForPeriod(
  db: AnyDb,
  userId: UserId,
  startDate: IsoDate,
  endDate: IsoDate
): { income: CopAmount; expenses: CopAmount } {
  const row = db
    .select({
      income: sql<number>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END)`,
      expenses: sql<number>`SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        between(transactions.date, startDate, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .get();
  return {
    income: (row?.income ?? 0) as CopAmount,
    expenses: (row?.expenses ?? 0) as CopAmount,
  };
}

export function getSpendingByCategoryForPeriod(
  db: AnyDb,
  userId: UserId,
  startDate: IsoDate,
  endDate: IsoDate
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
        between(transactions.date, startDate, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(transactions.categoryId)
    .orderBy(desc(sum(transactions.amount)))
    .all();
}
