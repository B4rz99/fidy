import {
  buildNotificationParseImprovementSample,
  shareNotificationParseImprovementSample,
  type ShareParseImprovementInput,
} from "@/features/capture-sources/diagnostics.public";
import { useSettingsStore } from "@/features/settings/hooks.public";
import { Alert, Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription, useTranslation } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { useCaptureSourcesStore } from "../store";
import { setupNotificationCapture } from "./setup";

const promptedParseImprovementTemplates = new Set<string>();

export function useNotificationCapture(db: AnyDb | null, userId: UserId | null) {
  const enabledPackages = useCaptureSourcesStore((s) => s.enabledPackages);
  const shareAnonymizedParseSamples = useSettingsStore((s) => s.shareAnonymizedParseSamples);
  const { t } = useTranslation();

  useSubscription(
    () => {
      if (!db || !userId) return;
      return setupNotificationCapture(db, userId, enabledPackages, {
        onParseImprovementRequest: (input) => {
          const shareInput: ShareParseImprovementInput = {
            ...input,
            userId,
            consent: shareAnonymizedParseSamples,
          };

          if (shareAnonymizedParseSamples) {
            void shareNotificationParseImprovementSample(shareInput).catch(captureError);
            return;
          }

          const sample = buildNotificationParseImprovementSample(input);
          const promptKey = `${userId}:${sample.template}`;
          if (promptedParseImprovementTemplates.has(promptKey)) return;
          promptedParseImprovementTemplates.add(promptKey);

          Alert.alert(
            t("parseImprovementPrompt.title"),
            t("parseImprovementPrompt.body", { template: sample.template }),
            [
              { text: t("parseImprovementPrompt.notNow"), style: "cancel" },
              {
                text: t("parseImprovementPrompt.share"),
                onPress: () =>
                  void shareNotificationParseImprovementSample({
                    ...input,
                    userId,
                    consent: true,
                  }).catch(captureError),
              },
            ]
          );
        },
      }).catch((error) => {
        captureError(error);
        return () => undefined;
      });
    },
    [db, userId, enabledPackages, shareAnonymizedParseSamples, t],
    Platform.OS === "android" && db != null && userId != null && enabledPackages.length > 0
  );
}
