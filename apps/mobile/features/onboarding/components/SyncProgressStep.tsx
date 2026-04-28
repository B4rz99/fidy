import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { logOnboardingEvent, trackOnboardingEvent } from "../lib/telemetry";
import { useOnboardingStore } from "../store";

export function SyncProgressStep() {
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const completeSync = useOnboardingStore((s) => s.completeSync);

  const accounts = useEmailCaptureStore((s) => s.accounts);
  const progress = useEmailCaptureStore((s) => s.progress);
  const isFetching = useEmailCaptureStore((s) => s.isFetching);
  const [syncOutcome, setSyncOutcome] = useState<{
    readonly savedCount: number;
    readonly hasAccountSuggestions: boolean;
  } | null>(null);

  const recentTransactions = useTransactionStore(useShallow((s) => s.pages.slice(0, 3)));

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const fetchStarted = useRef(false);
  const suggestionService = useMemo(() => createAccountSuggestionService(), []);

  const startSync = useCallback(() => {
    let isMounted = true;
    let resolveIdle: ((value: boolean) => void) | null = null;
    let unsubscribeIdle: (() => void) | null = null;

    const clearIdleWait = (shouldRetry: boolean) => {
      unsubscribeIdle?.();
      unsubscribeIdle = null;
      resolveIdle?.(shouldRetry);
      resolveIdle = null;
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

    if (accounts.length > 0 && !fetchStarted.current && db && userId) {
      fetchStarted.current = true;
      trackOnboardingEvent("email_sync_start", { accountCount: accounts.length });
      void (async () => {
        while (isMounted) {
          const outcome = await fetchAndProcessEmails(
            db,
            userId,
            getGmailClientId(),
            getOutlookClientId(),
            () => refreshTransactions(db, userId)
          );
          if (!isMounted) return;
          if (outcome.status === "completed") {
            setSyncOutcome({
              savedCount: outcome.savedCount,
              hasAccountSuggestions:
                suggestionService.listSuggestions({
                  db,
                  userId,
                  limit: 2,
                }).length > 0,
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
      clearIdleWait(false);
    };
  }, [accounts.length, db, suggestionService, userId]);

  // Start fetch on mount if we have accounts.
  useMountEffect(() => {
    const cleanup = startSync();
    return cleanup;
  });

  useEffect(() => {
    if (accounts.length === 0 || isFetching || fetchStarted.current || syncOutcome !== null) {
      return undefined;
    }
    return startSync();
  }, [accounts.length, isFetching, startSync, syncOutcome]);

  const livePercent = progress
    ? progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0
    : 0;

  const fetchDone = syncOutcome !== null;
  const percent = fetchDone ? 100 : livePercent;
  const savedCount = syncOutcome?.savedCount ?? progress?.saved ?? 0;
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

        {!fetchDone ? (
          <Text style={[styles.helperText, { color: secondaryColor }]}>
            {t("onboarding.syncing.helperText")}
          </Text>
        ) : null}
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          {
            backgroundColor: accentGreen,
            opacity: fetchDone ? 1 : 0.5,
          },
        ]}
        onPress={() => {
          trackOnboardingEvent("email_sync_continue", {
            savedCount,
            hasAccountSuggestions,
            recentTransactionCount: recentTransactions.length,
          });
          completeSync(hasAccountSuggestions);
        }}
        disabled={!fetchDone}
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
