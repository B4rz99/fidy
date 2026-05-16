import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import {
  dismissSourceEventFinancialMeaningReview,
  getFinancialMeaningQueueItemId,
  loadNeedsReviewEmails,
} from "@/features/email-capture/public";
import { refreshTransactions } from "@/features/transactions/store.public";
import { ScreenLayout } from "@/shared/components";
import { ChevronRight, TriangleAlert } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatMoney, formatSignedMoney, showErrorToast } from "@/shared/lib";
import type { ProcessedSourceEventId, ReviewCandidateId } from "@/shared/types/branded";
import { useFinancialMeaningReviewQueue } from "../hooks/use-financial-meaning-review-queue";
import { styles } from "./FinancialMeaningQueueScreen.styles";
import { ActionButton, EmptyState, SummaryCard } from "./shared";

function FinancialMeaningQueueCard({
  item,
  disabled,
  onReview,
  onDismiss,
  onSkip,
}: {
  readonly item: ReturnType<typeof useFinancialMeaningReviewQueue>["items"][number];
  readonly disabled: boolean;
  readonly onReview: () => void;
  readonly onDismiss: () => void;
  readonly onSkip: () => void;
}) {
  const { t, locale } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const providerLabel =
    item.processedSourceEvent.sourceId === "email_gmail"
      ? t("financialMeaningReview.providers.gmail")
      : t("financialMeaningReview.providers.outlook");
  const subject = item.processedSourceEvent.subject ?? "";
  const title =
    item.reviewCandidate.description ??
    item.processedSourceEvent.rawBodyPreview ??
    t("common.unknown");
  const subtitleDate = item.reviewCandidate.occurredAt ?? item.processedSourceEvent.receivedAt;
  const amount = item.reviewCandidate.amount;
  const transactionType = item.reviewCandidate.transactionType;
  const amountColor =
    transactionType === "income"
      ? accentGreen
      : transactionType === "expense"
        ? accentRed
        : primary;

  return (
    <View style={[styles.card, { backgroundColor: card, borderColor: borderSubtle }]}>
      <Pressable onPress={onReview} disabled={disabled} style={styles.cardPressable}>
        <View style={styles.cardMetaRow}>
          <Text style={[styles.cardMetaLabel, { color: tertiary }]}>{providerLabel}</Text>
          <ChevronRight size={16} color={tertiary} />
        </View>

        <Text style={[styles.subjectLabel, { color: secondary }]} numberOfLines={1}>
          {subject}
        </Text>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleWrap}>
            <Text style={[styles.cardTitle, { color: primary }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[styles.cardSubtitle, { color: secondary }]}>
              {format(subtitleDate, "PP", { locale: getDateFnsLocale(locale) })}
            </Text>
          </View>
          {amount != null ? (
            <Text
              style={[
                styles.cardAmount,
                {
                  color: amountColor,
                },
              ]}
            >
              {transactionType == null
                ? formatMoney(amount)
                : formatSignedMoney(amount, transactionType)}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <ActionButton
          label={t("financialMeaningReview.reviewMeaning")}
          onPress={onReview}
          disabled={disabled}
        />
        <ActionButton
          label={t("financialMeaningReview.dismiss")}
          onPress={onDismiss}
          variant="outline"
          disabled={disabled}
        />
        <ActionButton
          label={t("financialMeaningReview.skip")}
          onPress={onSkip}
          variant="ghost"
          disabled={disabled}
        />
      </View>
    </View>
  );
}

export function FinancialMeaningQueueScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { items, hasLoadedQueue, reloadQueue } = useFinancialMeaningReviewQueue({ db, userId });
  const { isBusy, run: guardedAction } = useAsyncGuard();
  const [skippedIds, setSkippedIds] = useState<readonly string[]>([]);

  const visibleItems = items.filter(
    (item) => !skippedIds.includes(getFinancialMeaningQueueItemId(item))
  );

  const handleDismissSourceEvent = (
    processedSourceEventId: ProcessedSourceEventId,
    reviewCandidateId: ReviewCandidateId
  ) => {
    void guardedAction(async () => {
      if (!db || !userId) {
        return;
      }

      try {
        await dismissSourceEventFinancialMeaningReview(
          db,
          userId,
          processedSourceEventId,
          reviewCandidateId
        );
        await loadNeedsReviewEmails(db, userId);
        await refreshTransactions(db, userId);
        await reloadQueue();
      } catch {
        showErrorToast(t("financialMeaningReview.errors.dismissFailed"));
      }
    });
  };

  return (
    <ScreenLayout
      title={t("financialMeaningReview.queueTitle")}
      variant="sub"
      onBack={() => router.back()}
    >
      {hasLoadedQueue && visibleItems.length === 0 ? (
        <EmptyState
          title={t("financialMeaningReview.emptyTitle")}
          subtitle={t("financialMeaningReview.emptySubtitle")}
        />
      ) : (
        <FlashList
          data={visibleItems}
          keyExtractor={getFinancialMeaningQueueItemId}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottom + 28 }]}
          contentInsetAdjustmentBehavior="automatic"
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          ListHeaderComponent={
            <SummaryCard
              icon={TriangleAlert}
              title={t("financialMeaningReview.queueCount", { count: visibleItems.length })}
              subtitle={t("financialMeaningReview.queueSubtitle")}
            />
          }
          renderItem={({ item }) => (
            <FinancialMeaningQueueCard
              item={item}
              disabled={isBusy}
              onReview={() =>
                router.push({
                  pathname: "/meaning-review",
                  params: {
                    processedSourceEventId: item.processedSourceEvent.id,
                    reviewCandidateId: item.reviewCandidate.id,
                  },
                } as never)
              }
              onDismiss={() =>
                handleDismissSourceEvent(item.processedSourceEvent.id, item.reviewCandidate.id)
              }
              onSkip={() =>
                setSkippedIds((current) =>
                  current.includes(getFinancialMeaningQueueItemId(item))
                    ? current
                    : [...current, getFinancialMeaningQueueItemId(item)]
                )
              }
            />
          )}
        />
      )}
    </ScreenLayout>
  );
}
