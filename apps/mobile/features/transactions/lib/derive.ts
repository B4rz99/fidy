import { toIsoDate } from "@/shared/lib/format-date";
import type { StoredTransaction } from "../schema";

export function deriveBalance(transactions: readonly StoredTransaction[]): number {
  return transactions.reduce(
    (acc, tx) => (tx.type === "income" ? acc + tx.amountCents : acc - tx.amountCents),
    0
  );
}

type CategorySpending = { readonly categoryId: string; readonly totalCents: number };

export function deriveSpendingByCategory(
  transactions: readonly StoredTransaction[],
  month: string
): readonly CategorySpending[] {
  const grouped = transactions
    .filter((tx) => tx.type === "expense" && toIsoDate(tx.date).startsWith(month))
    .reduce((acc, tx) => {
      acc.set(tx.categoryId, (acc.get(tx.categoryId) ?? 0) + tx.amountCents);
      return acc;
    }, new Map<string, number>());

  return Array.from(grouped, ([categoryId, totalCents]) => ({ categoryId, totalCents })).sort(
    (a, b) => b.totalCents - a.totalCents
  );
}

type DailySpending = { readonly date: string; readonly totalCents: number };

export function deriveDailySpending(
  transactions: readonly StoredTransaction[],
  startDate: string,
  endDate: string
): readonly DailySpending[] {
  const grouped = transactions
    .filter((tx) => {
      const isoDate = toIsoDate(tx.date);
      return tx.type === "expense" && isoDate >= startDate && isoDate <= endDate;
    })
    .reduce((acc, tx) => {
      const isoDate = toIsoDate(tx.date);
      acc.set(isoDate, (acc.get(isoDate) ?? 0) + tx.amountCents);
      return acc;
    }, new Map<string, number>());

  return Array.from(grouped, ([date, totalCents]) => ({ date, totalCents })).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
