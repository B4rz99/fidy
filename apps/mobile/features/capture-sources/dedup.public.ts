import type { AnyDb } from "@/shared/db";
import { assertCopAmount, assertIsoDate, assertUserId } from "@/shared/types/assertions";
import type { TransactionId } from "@/shared/types/branded";
import { findDuplicateTransaction as findDuplicateTransactionInternal } from "./lib/dedup";

export function findDuplicateTransaction(
  db: AnyDb,
  userId: string,
  amount: number,
  date: string,
  merchant: string
): Promise<TransactionId | null> {
  assertUserId(userId);
  assertCopAmount(amount);
  assertIsoDate(date);
  return findDuplicateTransactionInternal(db, userId, amount, date, merchant);
}
