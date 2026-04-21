import type { AnyDb } from "@/shared/db";
import { assertCopAmount, assertIsoDate, assertUserId } from "@/shared/types/assertions";
import type { TransactionId } from "@/shared/types/branded";
import { findDuplicateTransaction as findDuplicateTransactionInternal } from "./lib/dedup";

export function findDuplicateTransaction(input: {
  readonly db: AnyDb;
  readonly userId: string;
  readonly amount: number;
  readonly date: string;
  readonly merchant: string;
}): Promise<TransactionId | null> {
  assertUserId(input.userId);
  assertCopAmount(input.amount);
  assertIsoDate(input.date);
  return findDuplicateTransactionInternal(input);
}
