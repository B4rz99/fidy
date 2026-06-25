import {
  shareNotificationParseImprovementSample,
  type ShareParseImprovementInput,
} from "@/features/capture-sources/diagnostics.public";
import {
  retryPendingEmailParseImprovementSampleDeletion,
  setEmailParseImprovementSharingPreference,
} from "@/features/email-capture/parse-improvement.public";
import {
  isExplicitParseImprovementOptIn,
  useSettingsStore,
} from "@/features/settings/hooks.public";
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { useCaptureSourcesStore } from "../store";
import { setupNotificationCapture } from "./setup";

export function useNotificationCapture(db: AnyDb | null, userId: UserId | null) {
  const enabledPackages = useCaptureSourcesStore((s) => s.enabledPackages);
  const shareAnonymizedParseSamples = useSettingsStore((s) => s.shareAnonymizedParseSamples);

  useSubscription(
    () => {
      if (!db || !userId) return;
      return setupNotificationCapture(db, userId, enabledPackages, {
        onParseImprovementRequest: (input) => {
          const settings = useSettingsStore.getState();
          if (!settings.shareAnonymizedParseSamples) {
            return;
          }

          const shareInput: ShareParseImprovementInput = {
            ...input,
            userId,
            consent: true,
          };

          const share = () => shareNotificationParseImprovementSample(shareInput);
          void (
            isExplicitParseImprovementOptIn(settings)
              ? setEmailParseImprovementSharingPreference({
                  db,
                  enabled: true,
                  userId,
                }).then(share)
              : retryPendingEmailParseImprovementSampleDeletion({ db, userId }).then((result) =>
                  result.retried ? undefined : share()
                )
          ).catch(captureError);
        },
      }).catch((error) => {
        captureError(error);
        return () => undefined;
      });
    },
    [db, userId, enabledPackages, shareAnonymizedParseSamples],
    Platform.OS === "android" && db != null && userId != null && enabledPackages.length > 0
  );
}
