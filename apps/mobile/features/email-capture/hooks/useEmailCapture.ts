import { refreshTransactions } from "@/features/transactions/store.public";
import {
  isAuthoritativeParseImprovementOptOut,
  isExplicitParseImprovementOptIn,
  useSettingsStore,
} from "@/features/settings/hooks.public";
import { AppState } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { handleRecoverableError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { retryPendingEmailParseImprovementSampleDeletion } from "../parse-improvement.public";
import { getGmailClientId, getOutlookClientId } from "../schema";
import { fetchAndProcessEmails, initializeEmailCaptureSession, loadEmailAccounts } from "../store";

const readParseImprovementSharingSettings = () => {
  const state = useSettingsStore.getState();
  return {
    canDeleteDisabledSamples: state.isHydrated && isAuthoritativeParseImprovementOptOut(state),
    canEnableRemotePreference: state.isHydrated && isExplicitParseImprovementOptIn(state),
    enabled: state.shareAnonymizedParseSamples,
    isHydrated: state.isHydrated,
  };
};

export function useEmailCapture(db: AnyDb | null, userId: UserId | null) {
  const settingsHydrated = useSettingsStore((state) => state.isHydrated);

  useSubscription(
    () => {
      if (!db || !userId) return;
      initializeEmailCaptureSession(userId);

      const retryPendingOptOutDeletion = () => {
        const settings = readParseImprovementSharingSettings();
        if (!settings.canDeleteDisabledSamples) return;
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
            shareParseImprovementSamples: (() => {
              const settings = readParseImprovementSharingSettings();
              return settings.isHydrated && settings.enabled;
            })(),
            isShareParseImprovementSamplesEnabled: () => {
              const settings = readParseImprovementSharingSettings();
              return settings.isHydrated && settings.enabled;
            },
            canDeleteDisabledParseImprovementSamples: () => {
              const settings = readParseImprovementSharingSettings();
              return settings.canDeleteDisabledSamples;
            },
            canEnableRemoteParseImprovementPreference: () => {
              const settings = readParseImprovementSharingSettings();
              return settings.canEnableRemotePreference;
            },
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
    [db, userId, settingsHydrated],
    db != null && userId != null && settingsHydrated
  );
}
