import { refreshTransactions } from "@/features/transactions/store.public";
import { useSettingsStore } from "@/features/settings/hooks.public";
import { AppState } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { handleRecoverableError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { retryPendingEmailParseImprovementSampleDeletion } from "../parse-improvement.public";
import { getGmailClientId, getOutlookClientId } from "../schema";
import { fetchAndProcessEmails, initializeEmailCaptureSession, loadEmailAccounts } from "../store";

export function useEmailCapture(db: AnyDb | null, userId: UserId | null) {
  useSubscription(
    () => {
      if (!db || !userId) return;
      initializeEmailCaptureSession(userId);

      const retryPendingOptOutDeletion = () => {
        if (useSettingsStore.getState().shareAnonymizedParseSamples) return;
        void retryPendingEmailParseImprovementSampleDeletion({ db, userId }).catch(
          handleRecoverableError("Parse improvement deletion retry failed")
        );
      };

      retryPendingOptOutDeletion();

      const runFetch = () => {
        void fetchAndProcessEmails(
          db,
          userId,
          getGmailClientId(),
          getOutlookClientId(),
          () => refreshTransactions(db, userId),
          {
            shareParseImprovementSamples: useSettingsStore.getState().shareAnonymizedParseSamples,
            isShareParseImprovementSamplesEnabled: () =>
              useSettingsStore.getState().shareAnonymizedParseSamples,
          }
        ).catch(handleRecoverableError("Email sync failed"));
      };

      loadEmailAccounts(db, userId)
        .then(() => runFetch())
        .catch(handleRecoverableError("Email sync failed"));

      const subscription = AppState.addEventListener("change", (state) => {
        if (state !== "active") return;
        retryPendingOptOutDeletion();
        runFetch();
      });

      return () => {
        subscription.remove();
      };
    },
    [db, userId],
    db != null && userId != null
  );
}
