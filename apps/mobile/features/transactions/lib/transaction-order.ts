import { toIsoDate } from "@/shared/lib";
import type { StoredTransaction } from "../schema";

export function compareStoredTransactionsByRepositoryOrder(
  left: StoredTransaction,
  right: StoredTransaction
): number {
  const dateOrder = toIsoDate(right.date).localeCompare(toIsoDate(left.date));
  if (dateOrder !== 0) return dateOrder;

  return right.createdAt.getTime() - left.createdAt.getTime();
}

export function upsertStoredTransactionByRepositoryOrder(
  transactions: readonly StoredTransaction[],
  transaction: StoredTransaction
): StoredTransaction[] {
  return [...transactions.filter((item) => item.id !== transaction.id), transaction].sort(
    compareStoredTransactionsByRepositoryOrder
  );
}
