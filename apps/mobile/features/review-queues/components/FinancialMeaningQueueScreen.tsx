import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import {
  dismissFinancialMeaningReview,
  loadNeedsReviewEmails,
} from "@/features/email-capture/public";
import { getTransactionDisplayName } from "@/features/transactions/display.public";
import { refreshTransactions } from "@/features/transactions/store.public";
import { ScreenLayout } from "@/shared/components";
import { ChevronRight, TriangleAlert } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatSignedMoney, showErrorToast } from "@/shared/lib";
import type { ProcessedEmailId } from "@/shared/types/branded";
import { useFinancialMeaningReviewQueue } from "../hooks/use-financial-meaning-review-queue";
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
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const providerLabel =
    item.processedEmail.provider === "gmail"
      ? t("financialMeaningReview.providers.gmail")
      : t("financialMeaningReview.providers.outlook");

  return (
    <View style={[styles.card, { backgroundColor: card, borderColor: borderSubtle }]}>
      <Pressable onPress={onReview} disabled={disabled} style={styles.cardPressable}>
        <View style={styles.cardMetaRow}>
          <Text style={[styles.cardMetaLabel, { color: tertiary }]}>{providerLabel}</Text>
          <ChevronRight size={16} color={tertiary} />
        </View>

        <Text style={[styles.subjectLabel, { color: secondary }]} numberOfLines={1}>
          {item.processedEmail.subject}
        </Text>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleWrap}>
            <Text style={[styles.cardTitle, { color: primary }]} numberOfLines={2}>
              {getTransactionDisplayName(item.transaction, t("common.unknown"))}
            </Text>
            <Text style={[styles.cardSubtitle, { color: secondary }]}>
              {format(item.transaction.date, "PP", { locale: getDateFnsLocale(locale) })}
            </Text>
          </View>
          <Text
            style={[
              styles.cardAmount,
              {
                color: item.transaction.type === "income" ? accentGreen : accentRed,
              },
            ]}
          >
            {formatSignedMoney(item.transaction.amount, item.transaction.type)}
          </Text>
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

  const visibleItems = items.filter((item) => !skippedIds.includes(item.processedEmail.id));

  const handleDismiss = (processedEmailId: ProcessedEmailId) => {
    void guardedAction(async () => {
      if (!db || !userId) {
        return;
      }

      try {
        await dismissFinancialMeaningReview(db, processedEmailId);
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
          keyExtractor={(item) => item.processedEmail.id}
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
                  params: { processedEmailId: item.processedEmail.id },
                } as never)
              }
              onDismiss={() => handleDismiss(item.processedEmail.id)}
              onSkip={() =>
                setSkippedIds((current) =>
                  current.includes(item.processedEmail.id)
                    ? current
                    : [...current, item.processedEmail.id]
                )
              }
            />
          )}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  cardPressable: {
    gap: 8,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMetaLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  subjectLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    lineHeight: 22,
  },
  cardSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  cardAmount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
});
