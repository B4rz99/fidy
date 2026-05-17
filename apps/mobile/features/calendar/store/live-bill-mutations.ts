import { insertBillPayment } from "@/features/calendar/lib/repository";
import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/public";
import { toStoredTransaction } from "@/features/transactions/query.public";
import { useTransactionStore } from "@/features/transactions/store.public";
import { recordAutomatedTransactionWithLocalLedger } from "@/infrastructure/local-ledger/public";
import { createWriteThroughMutationModule } from "@/mutations";
import {
  captureError,
  toIsoDateTime,
  trackBillCreated,
  trackBillPaymentRecorded,
} from "@/shared/lib";
import { assertCopAmount } from "@/shared/types/assertions";
import { createCalendarBillMutationService } from "../lib/bill-mutation-service";
import { requestNotificationPermissions, scheduleBillNotifications } from "../lib/notifications";
import type { CalendarActor } from "./state";

export function createLiveCalendarBillMutations({ db, userId }: CalendarActor) {
  const mutations = createWriteThroughMutationModule(db);

  return createCalendarBillMutationService({
    getCommit: () => mutations.commit,
    getUserId: () => userId,
    recordBillPayment: async (input) => {
      const nowIso = toIsoDateTime(input.now);
      const amount = input.bill.amount;
      assertCopAmount(amount);
      const result = await recordAutomatedTransactionWithLocalLedger({
        db,
        transactionId: input.transactionId,
        now: nowIso,
        command: {
          userId: input.userId,
          type: "expense",
          amount,
          accountId: buildDefaultFinancialAccountId(input.userId),
          accountAttributionState: "confirmed",
          categoryId: input.bill.categoryId,
          occurredOn: input.dueDate,
          description: input.bill.name,
          counterpartyName: null,
          source: "manual",
        },
        afterRecord: (tx) => {
          insertBillPayment(tx, input.payment);
        },
      });
      return result.success
        ? {
            success: true,
            transaction: toStoredTransaction(result.transactionRow),
          }
        : { success: false };
    },
    requestNotificationPermissions,
    scheduleBillNotifications,
    reportAsyncError: captureError,
    addTransactionToCache: (transaction) => useTransactionStore.getState().addToCache(transaction),
    removeTransactionFromCache: (transactionId) =>
      useTransactionStore.getState().removeFromCache(transactionId),
    trackCreated: trackBillCreated,
    trackPaymentRecorded: trackBillPaymentRecorded,
  });
}
