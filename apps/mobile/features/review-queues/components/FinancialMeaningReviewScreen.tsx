import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useOptionalUserId } from "@/features/auth";
import {
  dismissFinancialMeaningReview,
  loadNeedsReviewEmails,
  resolveFinancialMeaningReview,
} from "@/features/email-capture";
import { refreshTransactions } from "@/features/transactions";
import { ScreenLayout } from "@/shared/components";
import { ArrowLeftRight, TriangleAlert } from "@/shared/components/icons";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatSignedMoney, showErrorToast } from "@/shared/lib";
import { requireProcessedEmailId } from "@/shared/types/assertions";
import { useFinancialMeaningReviewQueue } from "../hooks/use-financial-meaning-review-queue";
import { ActionButton, EmptyState, SummaryCard } from "./shared";

export function FinancialMeaningReviewScreen() {
  const router = useRouter();
  const { processedEmailId } = useLocalSearchParams<{ processedEmailId?: string }>();
  const { t, locale } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { items, hasLoadedQueue } = useFinancialMeaningReviewQueue({ db, userId });
  const { isBusy, run: guardedAction } = useAsyncGuard();
  const resolvedProcessedEmailId =
    typeof processedEmailId === "string" && processedEmailId.trim().length > 0
      ? requireProcessedEmailId(processedEmailId.trim())
      : null;
  const item = useMemo(
    () =>
      resolvedProcessedEmailId
        ? (items.find((entry) => entry.processedEmail.id === resolvedProcessedEmailId) ?? null)
        : null,
    [items, resolvedProcessedEmailId]
  );
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");

  if (hasLoadedQueue && item == null) {
    return (
      <ScreenLayout
        title={t("financialMeaningReview.reviewTitle")}
        variant="sub"
        onBack={() => router.back()}
      >
        <EmptyState
          title={t("financialMeaningReview.emptyTitle")}
          subtitle={t("financialMeaningReview.emptySubtitle")}
        />
      </ScreenLayout>
    );
  }

  if (!item) {
    return null;
  }

  const handleConfirmTransaction = () => {
    void guardedAction(async () => {
      if (!db || !userId) {
        return;
      }

      try {
        await resolveFinancialMeaningReview(db, item.processedEmail.id);
        await loadNeedsReviewEmails(db, userId);
        await refreshTransactions(db, userId);
        router.replace("/needs-review");
      } catch {
        showErrorToast(t("financialMeaningReview.errors.resolveFailed"));
      }
    });
  };

  const handleDismiss = () => {
    void guardedAction(async () => {
      if (!db || !userId) {
        return;
      }

      try {
        await dismissFinancialMeaningReview(db, item.processedEmail.id);
        await loadNeedsReviewEmails(db, userId);
        await refreshTransactions(db, userId);
        router.replace("/needs-review");
      } catch {
        showErrorToast(t("financialMeaningReview.errors.dismissFailed"));
      }
    });
  };

  return (
    <ScreenLayout
      title={t("financialMeaningReview.reviewTitle")}
      variant="sub"
      onBack={() => router.back()}
    >
      <View style={styles.container}>
        <SummaryCard
          icon={TriangleAlert}
          title={t("financialMeaningReview.reviewPill")}
          subtitle={t("financialMeaningReview.reviewSubtitle")}
        />

        <View style={[styles.card, { backgroundColor: card, borderColor: borderSubtle }]}>
          <Text style={[styles.metaLabel, { color: tertiary }]}>{item.processedEmail.subject}</Text>
          <View style={styles.titleRow}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: primary }]}>
                {item.transaction.description || t("common.unknown")}
              </Text>
              <Text style={[styles.subtitle, { color: secondary }]}>
                {format(item.transaction.date, "PP", { locale: getDateFnsLocale(locale) })}
              </Text>
            </View>
            <Text
              style={[
                styles.amount,
                {
                  color: item.transaction.type === "income" ? accentGreen : accentRed,
                },
              ]}
            >
              {formatSignedMoney(item.transaction.amount, item.transaction.type)}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.factBlock}>
            <Text style={[styles.factLabel, { color: secondary }]}>
              {t("financialMeaningReview.whatWeDetected")}
            </Text>
            <Text style={[styles.factValue, { color: primary }]}>
              {t("financialMeaningReview.transactionDetected")}
            </Text>
            <Text style={[styles.factCopy, { color: secondary }]}>
              {t("financialMeaningReview.transferHint")}
            </Text>
          </View>
        </View>

        <View style={styles.actionColumn}>
          <ActionButton
            label={t("financialMeaningReview.itsTransaction")}
            onPress={handleConfirmTransaction}
            disabled={isBusy}
          />
          <ActionButton
            label={t("financialMeaningReview.transfer")}
            onPress={() =>
              router.push(
                `/reclassify-transaction?transactionId=${item.transaction.id}&processedEmailId=${item.processedEmail.id}` as never
              )
            }
            variant="outline"
            disabled={isBusy}
          />
          <ActionButton
            label={t("financialMeaningReview.dismiss")}
            onPress={handleDismiss}
            variant="ghost"
            disabled={isBusy}
          />
        </View>

        <View style={[styles.transferTip, { backgroundColor: card, borderColor: borderSubtle }]}>
          <ArrowLeftRight size={18} color={secondary} />
          <Text style={[styles.transferTipCopy, { color: secondary }]}>
            {t("financialMeaningReview.transferExplanation")}
          </Text>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  metaLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
  },
  titleRow: {
    flexDirection: "row",
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  amount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    textAlign: "right",
  },
  separator: {
    height: 1,
    backgroundColor: "#00000012",
  },
  factBlock: {
    gap: 4,
  },
  factLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  factValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
  },
  factCopy: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  actionColumn: {
    gap: 10,
  },
  transferTip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  transferTipCopy: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
});
