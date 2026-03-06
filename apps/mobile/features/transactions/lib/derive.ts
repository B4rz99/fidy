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
    .reduce<Record<string, number>>((acc, tx) => {
      const current = acc[tx.categoryId] ?? 0;
      return { ...acc, [tx.categoryId]: current + tx.amountCents };
    }, {});

  return Object.entries(grouped)
    .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
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
    .reduce<Record<string, number>>((acc, tx) => {
      const isoDate = toIsoDate(tx.date);
      const current = acc[isoDate] ?? 0;
      return { ...acc, [isoDate]: current + tx.amountCents };
    }, {});

  return Object.entries(grouped)
    .map(([date, totalCents]) => ({ date, totalCents }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
