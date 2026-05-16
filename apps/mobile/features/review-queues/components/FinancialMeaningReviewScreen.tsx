import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import {
  confirmSourceEventFinancialMeaningReview,
  dismissFinancialMeaningReview,
  dismissSourceEventFinancialMeaningReview,
  loadNeedsReviewEmails,
  resolveFinancialMeaningReview,
} from "@/features/email-capture/public";
import { getTransactionDisplayName } from "@/features/transactions/display.public";
import { refreshTransactions } from "@/features/transactions/store.public";
import { ScreenLayout } from "@/shared/components";
import { ArrowLeftRight, TriangleAlert } from "@/shared/components/icons";
import { ScrollView, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatMoney, formatSignedMoney, showErrorToast } from "@/shared/lib";
import {
  requireProcessedEmailId,
  requireProcessedSourceEventId,
  requireReviewCandidateId,
} from "@/shared/types/assertions";
import { useFinancialMeaningReviewQueue } from "../hooks/use-financial-meaning-review-queue";
import { styles } from "./FinancialMeaningReviewScreen.styles";
import { ActionButton, EmptyState, SummaryCard } from "./shared";

type FinancialMeaningReviewItem = ReturnType<
  typeof useFinancialMeaningReviewQueue
>["items"][number];
type LegacyFinancialMeaningReviewItem = Extract<
  FinancialMeaningReviewItem,
  { readonly kind: "legacy_email" }
>;
type SourceEventFinancialMeaningReviewItem = Extract<
  FinancialMeaningReviewItem,
  { readonly kind: "source_event" }
>;

const isLegacyFinancialMeaningReviewItem = (
  item: FinancialMeaningReviewItem
): item is LegacyFinancialMeaningReviewItem => item.kind === "legacy_email";

export function FinancialMeaningReviewScreen() {
  const router = useRouter();
  const { processedEmailId, processedSourceEventId, reviewCandidateId } = useLocalSearchParams<{
    processedEmailId?: string;
    processedSourceEventId?: string;
    reviewCandidateId?: string;
  }>();
  const { t, locale } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { items, hasLoadedQueue } = useFinancialMeaningReviewQueue({ db, userId });
  const { isBusy, run: guardedAction } = useAsyncGuard();
  const resolvedProcessedEmailId =
    typeof processedEmailId === "string" && processedEmailId.trim().length > 0
      ? requireProcessedEmailId(processedEmailId.trim())
      : null;
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
      resolvedProcessedEmailId
        ? ((items.find(
            (entry) =>
              isLegacyFinancialMeaningReviewItem(entry) &&
              entry.processedEmail.id === resolvedProcessedEmailId
          ) as LegacyFinancialMeaningReviewItem | undefined) ?? null)
        : resolvedProcessedSourceEventId && resolvedReviewCandidateId
          ? ((items.find(
              (entry) =>
                entry.kind === "source_event" &&
                entry.processedSourceEvent.id === resolvedProcessedSourceEventId &&
                entry.reviewCandidate.id === resolvedReviewCandidateId
            ) as SourceEventFinancialMeaningReviewItem | undefined) ?? null)
          : null,
    [items, resolvedProcessedEmailId, resolvedProcessedSourceEventId, resolvedReviewCandidateId]
  );
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");

  if (hasLoadedQueue && reviewItem == null) {
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

  if (!reviewItem) {
    return null;
  }

  const handleConfirmTransaction = () => {
    void guardedAction(async () => {
      if (!db || !userId) {
        return;
      }

      try {
        if (reviewItem.kind === "legacy_email") {
          await resolveFinancialMeaningReview(db, reviewItem.processedEmail.id);
        } else {
          const confirmed = await confirmSourceEventFinancialMeaningReview(db, {
            userId,
            processedSourceEventId: reviewItem.processedSourceEvent.id,
            reviewCandidateId: reviewItem.reviewCandidate.id,
          });
          if (!confirmed) {
            showErrorToast(t("financialMeaningReview.errors.resolveFailed"));
            return;
          }
        }
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
        if (reviewItem.kind === "legacy_email") {
          await dismissFinancialMeaningReview(db, reviewItem.processedEmail.id);
        } else {
          await dismissSourceEventFinancialMeaningReview(
            db,
            userId,
            reviewItem.processedSourceEvent.id
          );
        }
        await loadNeedsReviewEmails(db, userId);
        await refreshTransactions(db, userId);
        router.replace("/needs-review");
      } catch {
        showErrorToast(t("financialMeaningReview.errors.dismissFailed"));
      }
    });
  };

  const title =
    reviewItem.kind === "legacy_email"
      ? getTransactionDisplayName(reviewItem.transaction, t("common.unknown"))
      : (reviewItem.reviewCandidate.description ??
        reviewItem.processedSourceEvent.rawBodyPreview ??
        t("common.unknown"));
  const subtitleDate =
    reviewItem.kind === "legacy_email"
      ? reviewItem.transaction.date
      : (reviewItem.reviewCandidate.occurredAt ?? reviewItem.processedSourceEvent.receivedAt);
  const amount =
    reviewItem.kind === "legacy_email"
      ? reviewItem.transaction.amount
      : reviewItem.reviewCandidate.amount;
  const transactionType =
    reviewItem.kind === "legacy_email"
      ? reviewItem.transaction.type
      : reviewItem.reviewCandidate.transactionType;
  const subject =
    reviewItem.kind === "legacy_email"
      ? reviewItem.processedEmail.subject
      : (reviewItem.processedSourceEvent.subject ?? "");

  return (
    <ScreenLayout
      title={t("financialMeaningReview.reviewTitle")}
      variant="sub"
      onBack={() => router.back()}
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

        <View style={[styles.card, { backgroundColor: card, borderColor: borderSubtle }]}>
          <Text style={[styles.metaLabel, { color: tertiary }]}>{subject}</Text>
          <View style={styles.titleRow}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: primary }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: secondary }]}>
                {format(subtitleDate, "PP", { locale: getDateFnsLocale(locale) })}
              </Text>
            </View>
            {amount != null ? (
              <Text
                style={[
                  styles.amount,
                  {
                    color:
                      transactionType == null
                        ? primary
                        : transactionType === "income"
                          ? accentGreen
                          : accentRed,
                  },
                ]}
              >
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
        </View>

        <View style={styles.actionColumn}>
          <ActionButton
            label={t("financialMeaningReview.itsTransaction")}
            onPress={handleConfirmTransaction}
            disabled={isBusy}
          />
          {reviewItem.kind === "legacy_email" ? (
            <ActionButton
              label={t("financialMeaningReview.transfer")}
              onPress={() =>
                router.push({
                  pathname: "/reclassify-transaction",
                  params: {
                    transactionId: reviewItem.transaction.id,
                    processedEmailId: reviewItem.processedEmail.id,
                  },
                } as never)
              }
              variant="outline"
              disabled={isBusy}
            />
          ) : null}
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
      </ScrollView>
    </ScreenLayout>
  );
}
