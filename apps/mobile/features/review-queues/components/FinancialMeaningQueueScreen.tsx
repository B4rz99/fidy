import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
import { getReviewQueueProviderLabel } from "../lib/source-labels";
import { styles } from "./FinancialMeaningQueueScreen.styles";
import { ActionButton, EmptyState, SummaryCard } from "./shared";

const QueueItemSeparator = () => <View style={styles.itemSeparator} />;

function FinancialMeaningQueueCard({
  item,
  disabled,
  onReview,
  onDismiss,
  onSkip,
}: {
  readonly item: ReturnType<typeof useFinancialMeaningReviewQueue>["items"][number];
  readonly disabled: boolean;
  readonly onReview: (
    processedSourceEventId: ProcessedSourceEventId,
    reviewCandidateId: ReviewCandidateId
  ) => void;
  readonly onDismiss: (
    processedSourceEventId: ProcessedSourceEventId,
    reviewCandidateId: ReviewCandidateId
  ) => void;
  readonly onSkip: (id: string) => void;
}) {
  const { t, locale } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const providerLabel = getReviewQueueProviderLabel(item.processedSourceEvent, t);
  const subject = item.processedSourceEvent.sourceEventId;
  const title = item.reviewCandidate.description ?? t("common.unknown");
  const subtitleDate = item.reviewCandidate.occurredAt ?? item.processedSourceEvent.receivedAt;
  const amount = item.reviewCandidate.amount;
  const transactionType = item.reviewCandidate.transactionType;
  const amountColor =
    transactionType === "income"
      ? accentGreen
      : transactionType === "expense"
        ? accentRed
        : primary;
  const reviewCandidateId = item.reviewCandidate.id;
  const processedSourceEventId = item.processedSourceEvent.id;
  const itemId = getFinancialMeaningQueueItemId(item);
  const handleReviewPress = useCallback(
    () => onReview(processedSourceEventId, reviewCandidateId),
    [onReview, processedSourceEventId, reviewCandidateId]
  );
  const handleDismissPress = useCallback(
    () => onDismiss(processedSourceEventId, reviewCandidateId),
    [onDismiss, processedSourceEventId, reviewCandidateId]
  );
  const handleSkipPress = useCallback(() => onSkip(itemId), [itemId, onSkip]);

  return (
    <View style={[styles.card, { backgroundColor: card, borderColor: borderSubtle }]}>
      <Pressable onPress={handleReviewPress} disabled={disabled} style={styles.cardPressable}>
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
          onPress={handleReviewPress}
          disabled={disabled}
        />
        <ActionButton
          label={t("financialMeaningReview.dismiss")}
          onPress={handleDismissPress}
          variant="outline"
          disabled={disabled}
        />
        <ActionButton
          label={t("financialMeaningReview.skip")}
          onPress={handleSkipPress}
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

  const handleReview = useCallback(
    (processedSourceEventId: ProcessedSourceEventId, reviewCandidateId: ReviewCandidateId) => {
      router.push({
        pathname: "/meaning-review",
        params: {
          processedSourceEventId,
          reviewCandidateId,
        },
      } as never);
    },
    [router]
  );

  const handleDismissSourceEvent = useCallback(
    (processedSourceEventId: ProcessedSourceEventId, reviewCandidateId: ReviewCandidateId) => {
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
    },
    [db, guardedAction, reloadQueue, t, userId]
  );

  const handleSkip = useCallback((id: string) => {
    setSkippedIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: (typeof visibleItems)[number] }) => (
      <FinancialMeaningQueueCard
        item={item}
        disabled={isBusy}
        onReview={handleReview}
        onDismiss={handleDismissSourceEvent}
        onSkip={handleSkip}
      />
    ),
    [handleDismissSourceEvent, handleReview, handleSkip, isBusy]
  );

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
          ItemSeparatorComponent={QueueItemSeparator}
          ListHeaderComponent={
            <SummaryCard
              icon={TriangleAlert}
              title={t("financialMeaningReview.queueCount", { count: visibleItems.length })}
              subtitle={t("financialMeaningReview.queueSubtitle")}
            />
          }
          renderItem={renderItem}
        />
      )}
    </ScreenLayout>
  );
}
