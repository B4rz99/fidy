import {
  countPendingEmailParseImprovementSamples,
  deleteEmailParseImprovementSamplesForUser,
  flushPendingEmailParseImprovementSamples,
  isEmailCaptureDebugEnabled,
  setEmailParseImprovementSharingPreference,
} from "@/features/email-capture/parse-improvement.public";
import { getDb } from "@/shared/db";
import { captureError, captureWarning } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { useSettingsStore } from "../store";

const logParseImprovementToggleForDebug = (
  payload: Record<string, number | string | boolean | null>
): void => {
  if (!isEmailCaptureDebugEnabled()) return;

  // eslint-disable-next-line no-console
  console.log("[email-capture] parse-improvement.toggle", payload);
};

const toggleFlushesByUserId = new Map<UserId, Promise<void>>();

const getErrorName = (error: unknown): string => (error instanceof Error ? error.name : "unknown");

const captureFlushFailureWarning = (failureTypes?: readonly string[]): void => {
  captureWarning("email_parse_improvement_sample_share_failed", {
    errorType: failureTypes && failureTypes.length > 0 ? failureTypes.join(",") : "unknown",
  });
};

const captureDeleteFailureWarning = (error: unknown): void => {
  captureWarning("email_parse_improvement_sample_delete_failed", {
    errorType: getErrorName(error),
  });
};

export function applyParseImprovementSharingToggle(input: {
  readonly enabled: boolean;
  readonly userId: UserId | null;
  readonly setShareAnonymizedParseSamples: (enabled: boolean) => void;
}): void {
  input.setShareAnonymizedParseSamples(input.enabled);
  if (!input.userId) {
    logParseImprovementToggleForDebug({ enabled: input.enabled, hasUserId: false, pending: null });
    return;
  }
  const userId = input.userId;

  let pending: number | null = null;
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb(userId);
  } catch (error) {
    captureError(error);
    logParseImprovementToggleForDebug({ enabled: input.enabled, hasUserId: true, pending: null });
    return;
  }

  if (isEmailCaptureDebugEnabled()) {
    try {
      pending = countPendingEmailParseImprovementSamples({ db, userId });
    } catch (error) {
      captureError(error);
    }
  }

  logParseImprovementToggleForDebug({ enabled: input.enabled, hasUserId: true, pending });

  const previousFlush = toggleFlushesByUserId.get(userId) ?? Promise.resolve();
  if (!input.enabled) {
    const deletion = previousFlush
      .catch(() => undefined)
      .then(async () => {
        const result = await deleteEmailParseImprovementSamplesForUser({ db, userId });
        logParseImprovementToggleForDebug({
          enabled: input.enabled,
          hasUserId: true,
          pending,
          deleted: result.deleted,
        });
      })
      .catch((error) => {
        captureError(error);
        captureDeleteFailureWarning(error);
      })
      .finally(() => {
        if (toggleFlushesByUserId.get(userId) === deletion) {
          toggleFlushesByUserId.delete(userId);
        }
      });
    toggleFlushesByUserId.set(userId, deletion);
    return;
  }

  const flush = previousFlush
    .catch(() => undefined)
    .then(async () => {
      if (!useSettingsStore.getState().shareAnonymizedParseSamples) return;
      await setEmailParseImprovementSharingPreference({ db, enabled: true, userId });
      const result = await flushPendingEmailParseImprovementSamples({
        db,
        userId,
        isSharingEnabled: () => useSettingsStore.getState().shareAnonymizedParseSamples,
      });
      if (result.failed > 0) captureFlushFailureWarning(result.failureTypes);
      logParseImprovementToggleForDebug({
        enabled: input.enabled,
        hasUserId: true,
        pending,
        shared: result.shared,
        failed: result.failed,
      });
    })
    .catch((error) => {
      captureError(error);
      captureFlushFailureWarning([getErrorName(error)]);
    })
    .finally(() => {
      if (toggleFlushesByUserId.get(userId) === flush) {
        toggleFlushesByUserId.delete(userId);
      }
    });
  toggleFlushesByUserId.set(userId, flush);
}
