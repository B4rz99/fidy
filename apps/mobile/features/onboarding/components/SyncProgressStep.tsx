import { useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { createAccountSuggestionService } from "@/features/account-suggestions/public";
import { useOptionalUserId } from "@/features/auth/public";
import {
  fetchAndProcessEmails,
  getGmailClientId,
  getOutlookClientId,
  useEmailCaptureStore,
} from "@/features/email-capture/public";
import { useSettingsStore } from "@/features/settings/hooks.public";
import { refreshTransactions, useTransactionStore } from "@/features/transactions/store.public";
import { Pressable, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { SYNC_EARLY_UNLOCK_TIMEOUT_MS, shouldUnlockEmailSyncStep } from "../lib/sync-unlock";
import { logOnboardingEvent, trackOnboardingEvent } from "../lib/telemetry";
import { useOnboardingStore } from "../store";
import {
  getRecentTransactionPreview,
  RECENT_TRANSACTION_PREVIEW_LIMIT,
  type SyncOutcome,
} from "./SyncProgressStep.helpers";
import { styles } from "./SyncProgressStep.styles";
import { SyncImportProgress } from "./SyncImportProgress";
import { SyncTransactionPreview } from "./SyncTransactionPreview";

export function SyncProgressStep() {
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const completeSync = useOnboardingStore((s) => s.completeSync);
  const accounts = useEmailCaptureStore((s) => s.accounts);
  const progress = useEmailCaptureStore((s) => s.progress);
  const shareAnonymizedParseSamples = useSettingsStore((s) => s.shareAnonymizedParseSamples);
  const [syncOutcome, setSyncOutcome] = useState<SyncOutcome | null>(null);
  const recentTransactions = useTransactionStore(
    useShallow((s) => getRecentTransactionPreview(s.pages))
  );
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const fetchStarted = useRef(false);
  const suggestionService = useMemo(() => createAccountSuggestionService(), []);

  const startSync = () => {
    let isMounted = true;
    let resolveIdle: ((value: boolean) => void) | null = null;
    let unsubscribeIdle: (() => void) | null = null;
    let lastLoggedProgress = "";
    let syncUnlockTimer: ReturnType<typeof setTimeout> | null = null;
    let syncStartedAt = Date.now();
    let hasUnlockedSync = false;
    let syncCompleted = false;
    let lastPreviewRefreshFoundCount = 0;

    const clearIdleWait = (shouldRetry: boolean) => {
      unsubscribeIdle?.();
      unsubscribeIdle = null;
      resolveIdle?.(shouldRetry);
      resolveIdle = null;
    };

    const getHasAccountSuggestions = () =>
      Boolean(
        db &&
        userId &&
        suggestionService.listSuggestions({
          db,
          userId,
          limit: 2,
        }).length > 0
      );

    const unlockSync = (input: {
      readonly foundCount: number;
      readonly importComplete: boolean;
      readonly reason: "early_results" | "timeout" | "complete";
    }) => {
      if (!isMounted) return;
      if (input.importComplete) syncCompleted = true;
      const hasAccountSuggestions = getHasAccountSuggestions();
      if (!hasUnlockedSync) {
        hasUnlockedSync = true;
        trackOnboardingEvent("email_sync_unlocked", {
          reason: input.reason,
          foundCount: input.foundCount,
          hasAccountSuggestions,
        });
      }
      setSyncOutcome({
        savedCount: input.foundCount,
        hasAccountSuggestions,
        importComplete: input.importComplete,
      });
    };

    const waitForFetchIdle = () => {
      if (!useEmailCaptureStore.getState().isFetching) return Promise.resolve(isMounted);

      return new Promise<boolean>((resolve) => {
        resolveIdle = resolve;
        unsubscribeIdle = useEmailCaptureStore.subscribe((state) => {
          if (state.isFetching) return;
          clearIdleWait(isMounted);
        });
      });
    };

    const refreshPreviewForFoundCount = (foundCount: number) => {
      if (!db || !userId) return;
      if (lastPreviewRefreshFoundCount >= RECENT_TRANSACTION_PREVIEW_LIMIT) return;
      if (foundCount <= lastPreviewRefreshFoundCount) return;
      lastPreviewRefreshFoundCount = foundCount;
      void refreshTransactions(db, userId);
    };

    const unsubscribeProgress = useEmailCaptureStore.subscribe((state) => {
      const snapshot = state.progress;
      if (!snapshot) return;

      const logKey = [
        snapshot.completed,
        snapshot.total,
        snapshot.saved,
        snapshot.needsReview,
        snapshot.failed,
      ].join(":");
      if (logKey === lastLoggedProgress) return;
      lastLoggedProgress = logKey;

      logOnboardingEvent("email_sync_progress", {
        completed: snapshot.completed,
        total: snapshot.total,
        savedCount: snapshot.saved,
        needsReviewCount: snapshot.needsReview,
        failedCount: snapshot.failed,
        foundCount: snapshot.saved + snapshot.needsReview,
      });

      const foundCount = snapshot.saved + snapshot.needsReview;
      refreshPreviewForFoundCount(foundCount);
      if (
        shouldUnlockEmailSyncStep({
          foundCount,
          elapsedMs: Date.now() - syncStartedAt,
          isComplete: false,
        })
      ) {
        unlockSync({
          foundCount,
          importComplete: false,
          reason: foundCount > 0 ? "early_results" : "timeout",
        });
      }
    });

    if (accounts.length > 0 && !fetchStarted.current && db && userId) {
      fetchStarted.current = true;
      syncStartedAt = Date.now();
      syncUnlockTimer = setTimeout(() => {
        if (syncCompleted) return;
        const snapshot = useEmailCaptureStore.getState().progress;
        unlockSync({
          foundCount: snapshot ? snapshot.saved + snapshot.needsReview : 0,
          importComplete: false,
          reason: "timeout",
        });
      }, SYNC_EARLY_UNLOCK_TIMEOUT_MS);
      trackOnboardingEvent("email_sync_start", { accountCount: accounts.length });
      const runFetchUntilComplete = async (): Promise<void> => {
        if (!isMounted) return;

        const outcome = await fetchAndProcessEmails(
          db,
          userId,
          getGmailClientId(),
          getOutlookClientId(),
          () => refreshTransactions(db, userId),
          {
            parseProfile: "initial_sync",
            shareParseImprovementSamples: shareAnonymizedParseSamples,
          }
        );

        if (outcome.status === "completed") {
          if (isMounted) {
            const foundCount = outcome.savedCount + outcome.needsReviewCount;
            const hasAccountSuggestions = getHasAccountSuggestions();
            trackOnboardingEvent("email_sync_complete", {
              savedCount: outcome.savedCount,
              needsReviewCount: outcome.needsReviewCount,
              failedCount: outcome.failedCount,
              foundCount,
              hasAccountSuggestions,
              recentTransactionCount: getRecentTransactionPreview(
                useTransactionStore.getState().pages
              ).length,
            });
            unlockSync({
              foundCount,
              importComplete: true,
              reason: "complete",
            });
          }
          return;
        }

        if (isMounted && outcome.reason === "already_fetching") {
          const shouldRetry = await waitForFetchIdle();
          if (shouldRetry) await runFetchUntilComplete();
        }
      };

      void runFetchUntilComplete();
    } else if (accounts.length === 0) {
      logOnboardingEvent("email_sync_no_accounts");
    }

    return () => {
      isMounted = false;
      if (syncUnlockTimer) clearTimeout(syncUnlockTimer);
      unsubscribeProgress();
      clearIdleWait(false);
    };
  };
  useMountEffect(() => {
    const cleanup = startSync();
    return cleanup;
  });
  const livePercent = (() => {
    if (!progress) return 0;
    if (progress.total <= 0) return 0;
    return Math.round((progress.completed / progress.total) * 100);
  })();

  const importComplete = syncOutcome?.importComplete ?? false;
  const percent = importComplete ? 100 : livePercent;
  const liveFoundCount = progress ? progress.saved + progress.needsReview : 0;
  const savedCount = Math.max(syncOutcome?.savedCount ?? 0, liveFoundCount);
  const hasAccountSuggestions = syncOutcome?.hasAccountSuggestions ?? false;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("onboarding.syncing.processing")}
        </Text>

        <SyncImportProgress
          importComplete={importComplete}
          isWaiting={syncOutcome === null}
          percent={percent}
          savedCount={savedCount}
        />

        <SyncTransactionPreview
          fallbackLabel={t("common.transaction")}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          title={t("onboarding.syncing.recentCaptures")}
          transactions={recentTransactions}
        />

        {syncOutcome === null ? (
          <Text style={[styles.helperText, { color: secondaryColor }]}>
            {t("onboarding.syncing.helperText")}
          </Text>
        ) : null}
        {syncOutcome !== null && !importComplete ? (
          <Text style={[styles.helperText, { color: secondaryColor }]}>
            {t("onboarding.syncing.backgroundHelperText")}
          </Text>
        ) : null}
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          {
            backgroundColor: accentGreen,
            opacity: syncOutcome !== null ? 1 : 0.5,
          },
        ]}
        onPress={() => {
          trackOnboardingEvent("email_sync_continue", {
            savedCount,
            hasAccountSuggestions,
            importComplete,
            recentTransactionCount: recentTransactions.length,
          });
          completeSync(hasAccountSuggestions);
        }}
        disabled={syncOutcome === null}
      >
        <Text style={styles.primaryButtonText}>{t("onboarding.syncing.continue")}</Text>
      </Pressable>
    </View>
  );
}
