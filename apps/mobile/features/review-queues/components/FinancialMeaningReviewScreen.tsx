import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import {
  confirmSourceEventFinancialMeaningReview,
  dismissSourceEventFinancialMeaningReview,
  loadNeedsReviewEmails,
} from "@/features/email-capture/public";
import { refreshTransactions } from "@/features/transactions/store.public";
import { Card, ScreenLayout } from "@/shared/components";
import { ArrowLeftRight, TriangleAlert } from "@/shared/components/icons";
import { ScrollView, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatMoney, formatSignedMoney, showErrorToast } from "@/shared/lib";
import { requireProcessedSourceEventId, requireReviewCandidateId } from "@/shared/types/assertions";
import { useFinancialMeaningReviewQueue } from "../hooks/use-financial-meaning-review-queue";
import { getReviewQueueProviderLabel } from "../lib/source-labels";
import { styles } from "./FinancialMeaningReviewScreen.styles";
import { ActionButton, EmptyState, SummaryCard } from "./shared";

type FinancialMeaningReviewItem = ReturnType<
  typeof useFinancialMeaningReviewQueue
>["items"][number];
type SourceEventFinancialMeaningReviewItem = Extract<
  FinancialMeaningReviewItem,
  { readonly kind: "source_event" }
>;

export function FinancialMeaningReviewScreen() {
  const { push, replace, back } = useRouter();
  const { processedSourceEventId, reviewCandidateId } = useLocalSearchParams<{
    processedSourceEventId?: string;
    reviewCandidateId?: string;
  }>();
  const { t, locale } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { items, hasLoadedQueue } = useFinancialMeaningReviewQueue({ db, userId });
  const { isBusy, run: guardedAction } = useAsyncGuard();
  const resolvedProcessedSourceEventId =
    typeof processedSourceEventId === "string" && processedSourceEventId.trim().length > 0
      ? requireProcessedSourceEventId(processedSourceEventId.trim())
      : null;
  const resolvedReviewCandidateId =
    typeof reviewCandidateId === "string" && reviewCandidateId.trim().length > 0
      ? requireReviewCandidateId(reviewCandidateId.trim())
      : null;
  const reviewItem = useMemo<FinancialMeaningReviewItem | null>(
    () =>
      resolvedProcessedSourceEventId && resolvedReviewCandidateId
        ? ((items.find(
            (entry) =>
              entry.processedSourceEvent.id === resolvedProcessedSourceEventId &&
              entry.reviewCandidate.id === resolvedReviewCandidateId
          ) as SourceEventFinancialMeaningReviewItem | undefined) ?? null)
        : null,
    [items, resolvedProcessedSourceEventId, resolvedReviewCandidateId]
  );
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  if (hasLoadedQueue && reviewItem == null) {
    return (
      <ScreenLayout
        title={t("financialMeaningReview.reviewTitle")}
        variant="sub"
        onBack={() => back()}
      >
        <EmptyState
          title={t("financialMeaningReview.emptyTitle")}
          subtitle={t("financialMeaningReview.emptySubtitle")}
        />
      </ScreenLayout>
    );
  }

  if (!reviewItem) {
    return null;
  }

  const handleConfirmTransaction = () => {
    void guardedAction(async () => {
      if (!db || !userId) {
        return;
      }

      try {
        const confirmed = await confirmSourceEventFinancialMeaningReview(db, {
          userId,
          processedSourceEventId: reviewItem.processedSourceEvent.id,
          reviewCandidateId: reviewItem.reviewCandidate.id,
        });
        if (!confirmed) {
          showErrorToast(t("financialMeaningReview.errors.resolveFailed"));
          return;
        }
        await loadNeedsReviewEmails(db, userId);
        await refreshTransactions(db, userId);
        replace("/needs-review");
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
        await dismissSourceEventFinancialMeaningReview(
          db,
          userId,
          reviewItem.processedSourceEvent.id,
          reviewItem.reviewCandidate.id
        );
        await Promise.all([loadNeedsReviewEmails(db, userId), refreshTransactions(db, userId)]);
        replace("/needs-review");
      } catch {
        showErrorToast(t("financialMeaningReview.errors.dismissFailed"));
      }
    });
  };

  const providerLabel = getReviewQueueProviderLabel(reviewItem.processedSourceEvent, t);
  const title = reviewItem.reviewCandidate.description ?? providerLabel;
  const subtitleDate =
    reviewItem.reviewCandidate.occurredAt ?? reviewItem.processedSourceEvent.receivedAt;
  const amount = reviewItem.reviewCandidate.amount;
  const transactionType = reviewItem.reviewCandidate.transactionType;
  const amountColor =
    transactionType === "income"
      ? accentGreen
      : transactionType === "expense"
        ? accentRed
        : primary;
  const subject = providerLabel;

  const handleConvertToTransfer = () => {
    if (reviewItem.processedSourceEvent.transactionId == null) return;

    push({
      pathname: "/reclassify-transaction",
      params: {
        transactionId: reviewItem.processedSourceEvent.transactionId,
        processedSourceEventId: reviewItem.processedSourceEvent.id,
        reviewCandidateId: reviewItem.reviewCandidate.id,
      },
    } as never);
  };

  return (
    <ScreenLayout
      title={t("financialMeaningReview.reviewTitle")}
      variant="sub"
      onBack={() => back()}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: bottom + 28 }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <SummaryCard
          icon={TriangleAlert}
          title={t("financialMeaningReview.reviewPill")}
          subtitle={t("financialMeaningReview.reviewSubtitle")}
        />

        <Card radius={20} borderWidth={1} contentStyle={styles.cardContent}>
          <Text style={[styles.metaLabel, { color: tertiary }]}>{subject}</Text>
          <View style={styles.titleRow}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: primary }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: secondary }]}>
                {format(subtitleDate, "PP", { locale: getDateFnsLocale(locale) })}
              </Text>
            </View>
            {amount != null ? (
              <Text style={[styles.amount, { color: amountColor }]}>
                {transactionType == null
                  ? formatMoney(amount)
                  : formatSignedMoney(amount, transactionType)}
              </Text>
            ) : null}
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
        </Card>

        <View style={styles.actionColumn}>
          <ActionButton
            label={t("financialMeaningReview.itsTransaction")}
            onPress={handleConfirmTransaction}
            disabled={isBusy}
          />
          <ActionButton
            label={t("financialMeaningReview.transfer")}
            onPress={handleConvertToTransfer}
            variant="outline"
            disabled={isBusy || reviewItem.processedSourceEvent.transactionId == null}
          />
          <ActionButton
            label={t("financialMeaningReview.dismiss")}
            onPress={handleDismiss}
            variant="ghost"
            disabled={isBusy}
          />
        </View>

        <Card radius={18} borderWidth={1} contentStyle={styles.transferTipContent}>
          <ArrowLeftRight size={18} color={secondary} />
          <Text style={[styles.transferTipCopy, { color: secondary }]}>
            {t("financialMeaningReview.transferExplanation")}
          </Text>
        </Card>
      </ScrollView>
    </ScreenLayout>
  );
}
