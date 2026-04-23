import type { StoredTransaction } from "@/features/transactions/public";
import type { CreateCalendarBillMutationServiceDeps } from "./types";

export function applyBillPaymentSideEffects(
  deps: CreateCalendarBillMutationServiceDeps,
  transaction: StoredTransaction
) {
  try {
    deps.addTransactionToCache(transaction);
    deps.trackPaymentRecorded();
  } catch (error) {
    deps.reportAsyncError(error);
  }
}
