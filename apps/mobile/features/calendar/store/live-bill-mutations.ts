import { useTransactionStore } from "@/features/transactions";
import { createWriteThroughMutationModule } from "@/mutations";
import { captureError, trackBillCreated, trackBillPaymentRecorded } from "@/shared/lib";
import { createCalendarBillMutationService } from "../lib/bill-mutation-service";
import { requestNotificationPermissions, scheduleBillNotifications } from "../lib/notifications";
import type { CalendarActor } from "./state";

export function createLiveCalendarBillMutations({ db, userId }: CalendarActor) {
  const mutations = createWriteThroughMutationModule(db);

  return createCalendarBillMutationService({
    getCommit: () => mutations.commit,
    getUserId: () => userId,
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
