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
import { refreshTransactions, useTransactionStore } from "@/features/transactions/store.public";
import { ProgressBar } from "@/shared/components";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import { SYNC_EARLY_UNLOCK_TIMEOUT_MS, shouldUnlockEmailSyncStep } from "../lib/sync-unlock";
import { logOnboardingEvent, trackOnboardingEvent } from "../lib/telemetry";
import { useOnboardingStore } from "../store";

type SyncOutcome = {
  readonly savedCount: number;
  readonly hasAccountSuggestions: boolean;
  readonly importComplete: boolean;
};

export function SyncProgressStep() {
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const completeSync = useOnboardingStore((s) => s.completeSync);

  const accounts = useEmailCaptureStore((s) => s.accounts);
  const progress = useEmailCaptureStore((s) => s.progress);
  const [syncOutcome, setSyncOutcome] = useState<SyncOutcome | null>(null);

  const recentTransactions = useTransactionStore(useShallow((s) => s.pages.slice(0, 3)));

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
      void (async () => {
        while (isMounted) {
          const outcome = await fetchAndProcessEmails(
            db,
            userId,
            getGmailClientId(),
            getOutlookClientId(),
            () => refreshTransactions(db, userId),
            { parseProfile: "initial_sync" }
          );
          if (!isMounted) return;
          if (outcome.status === "completed") {
            const foundCount = outcome.savedCount + outcome.needsReviewCount;
            const hasAccountSuggestions = getHasAccountSuggestions();
            trackOnboardingEvent("email_sync_complete", {
              savedCount: outcome.savedCount,
              needsReviewCount: outcome.needsReviewCount,
              failedCount: outcome.failedCount,
              foundCount,
              hasAccountSuggestions,
              recentTransactionCount: useTransactionStore.getState().pages.slice(0, 3).length,
            });
            unlockSync({
              foundCount,
              importComplete: true,
              reason: "complete",
            });
            return;
          }

          if (outcome.reason !== "already_fetching" || !(await waitForFetchIdle())) return;
        }
      })();
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

  // Start fetch on mount if we have accounts.
  useMountEffect(() => {
    const cleanup = startSync();
    return cleanup;
  });

  const livePercent = progress
    ? progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0
    : 0;

  const canContinue = syncOutcome !== null;
  const importComplete = syncOutcome?.importComplete ?? false;
  const percent = importComplete ? 100 : livePercent;
  const savedCount =
    syncOutcome?.savedCount ?? (progress ? progress.saved + progress.needsReview : 0);
  const hasAccountSuggestions = syncOutcome?.hasAccountSuggestions ?? false;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("onboarding.syncing.processing")}
        </Text>

        <View style={styles.progressSection}>
          <ProgressBar percent={percent} height={10} />
          <Text style={[styles.counter, { color: accentGreen }]}>
            {t("onboarding.syncing.transactionsFound", { count: savedCount })}
          </Text>
        </View>

        {recentTransactions.length > 0 ? (
          <View style={styles.previewSection}>
            <Text style={[styles.previewTitle, { color: secondaryColor }]}>
              {t("onboarding.syncing.recentCaptures")}
            </Text>
            {recentTransactions.map((tx) => (
              <View key={tx.id} style={styles.previewRow}>
                <Text
                  style={[styles.previewDescription, { color: primaryColor }]}
                  numberOfLines={1}
                >
                  {tx.description || t("common.transaction")}
                </Text>
                <Text style={[styles.previewAmount, { color: primaryColor }]}>
                  {formatMoney(tx.amount)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!canContinue ? (
          <Text style={[styles.helperText, { color: secondaryColor }]}>
            {t("onboarding.syncing.helperText")}
          </Text>
        ) : null}
        {canContinue && !importComplete ? (
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
            opacity: canContinue ? 1 : 0.5,
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
        disabled={!canContinue}
      >
        <Text style={styles.primaryButtonText}>{t("onboarding.syncing.continue")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  progressSection: {
    gap: 8,
  },
  counter: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    textAlign: "center",
  },
  previewSection: {
    gap: 8,
  },
  previewTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  previewDescription: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
  previewAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  helperText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    textAlign: "center",
  },
  primaryButton: {
    borderRadius: 14,
    borderCurve: "continuous",
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
