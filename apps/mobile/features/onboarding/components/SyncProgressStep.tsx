import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { ProgressBar } from "@/features/budget/components/ProgressBar";
import {
  getGmailClientId,
  getOutlookClientId,
  useEmailCaptureStore,
} from "@/features/email-capture";
import { useTransactionStore } from "@/features/transactions";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import { useOnboardingStore } from "../store";

export function SyncProgressStep() {
  const { t } = useTranslation();
  const nextStep = useOnboardingStore((s) => s.nextStep);

  const accounts = useEmailCaptureStore((s) => s.accounts);
  const fetchAndProcess = useEmailCaptureStore((s) => s.fetchAndProcess);
  const progress = useEmailCaptureStore((s) => s.progress);
  const isFetching = useEmailCaptureStore((s) => s.isFetching);

  const recentTransactions = useTransactionStore(useShallow((s) => s.pages.slice(0, 3)));

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const fetchStarted = useRef(false);
  // Snapshot final values so they persist after the store clears progress
  const finalPercent = useRef(0);
  const finalSavedCount = useRef(0);

  // Start fetch on mount if we have accounts
  useMountEffect(() => {
    if (accounts.length > 0 && !fetchStarted.current) {
      fetchStarted.current = true;
      void fetchAndProcess(getGmailClientId(), getOutlookClientId());
    }
  });

  const livePercent = progress
    ? progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0
    : 0;

  // Keep the high-water mark so the bar doesn't reset when the store clears progress
  if (livePercent > finalPercent.current) {
    finalPercent.current = livePercent;
  }
  if (progress && progress.saved > finalSavedCount.current) {
    finalSavedCount.current = progress.saved;
  }

  // Fetch is done when: it was started and is no longer fetching
  // (covers both progress-shown and silent-processing paths)
  const fetchDone = fetchStarted.current && !isFetching;
  const percent = fetchDone ? 100 : finalPercent.current;
  const savedCount = finalSavedCount.current;

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
        onPress={nextStep}
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
