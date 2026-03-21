import { toIsoDate } from "@/shared/lib";
import type { CategoryId, CopAmount, IsoDate, Month } from "@/shared/types/branded";
import type { StoredTransaction } from "../schema";

export function deriveBalance(transactions: readonly StoredTransaction[]): CopAmount {
  return transactions.reduce(
    (acc, tx) => (tx.type === "income" ? acc + tx.amount : acc - tx.amount),
    0
  ) as CopAmount;
}

type CategorySpending = { readonly categoryId: CategoryId; readonly total: CopAmount };

export function deriveSpendingByCategory(
  transactions: readonly StoredTransaction[],
  month: Month
): readonly CategorySpending[] {
  const grouped = transactions
    .filter((tx) => tx.type === "expense" && toIsoDate(tx.date).startsWith(month))
    .reduce((acc, tx) => {
      acc.set(tx.categoryId, ((acc.get(tx.categoryId) ?? 0) + tx.amount) as CopAmount);
      return acc;
    }, new Map<CategoryId, CopAmount>());

  return Array.from(grouped, ([categoryId, total]) => ({ categoryId, total })).sort(
    (a, b) => b.total - a.total
  );
}

type DailySpending = { readonly date: IsoDate; readonly total: CopAmount };

export function deriveDailySpending(
  transactions: readonly StoredTransaction[],
  startDate: IsoDate,
  endDate: IsoDate
): readonly DailySpending[] {
  const grouped = transactions
    .filter((tx) => {
      const isoDate = toIsoDate(tx.date);
      return tx.type === "expense" && isoDate >= startDate && isoDate <= endDate;
    })
    .reduce((acc, tx) => {
      const isoDate = toIsoDate(tx.date);
      acc.set(isoDate, ((acc.get(isoDate) ?? 0) + tx.amount) as CopAmount);
      return acc;
    }, new Map<IsoDate, CopAmount>());

  return Array.from(grouped, ([date, total]) => ({ date, total })).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
