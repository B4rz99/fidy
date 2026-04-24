import type { StoredTransaction } from "@/features/transactions/query.public";
import type { CreateCalendarBillMutationServiceDeps } from "./types";

export function applyBillPaymentSideEffects(
  deps: CreateCalendarBillMutationServiceDeps,
  transaction: StoredTransaction
) {
  try {
    deps.addTransactionToCache(transaction);
  } catch (error) {
    deps.reportAsyncError(error);
  }

  try {
    deps.trackPaymentRecorded();
  } catch (error) {
    deps.reportAsyncError(error);
  }
}
