import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import { getTransactionDisplayName } from "@/features/transactions/display.public";
import { refreshTransactions } from "@/features/transactions/store.public";
import { ScreenLayout } from "@/shared/components";
import { ChevronRight, Landmark } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatSignedMoney, showErrorToast } from "@/shared/lib";
import type { TransactionId } from "@/shared/types/branded";
import { useAttributionReviewQueue } from "../hooks/use-attribution-review-queue";
import { ActionButton, EmptyState, SummaryCard } from "./shared";

function AttributionQueueCard({
  item,
  disabled,
  onConfirm,
  onChooseAnother,
  onOpenDetails,
  onSkip,
}: {
  readonly item: ReturnType<typeof useAttributionReviewQueue>["items"][number];
  readonly disabled: boolean;
  readonly onConfirm: () => void;
  readonly onChooseAnother: () => void;
  readonly onOpenDetails: () => void;
  readonly onSkip: () => void;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentRed = useThemeColor("accentRed");

  return (
    <View style={[styles.card, { backgroundColor: card, borderColor: borderSubtle }]}>
      <Pressable onPress={onOpenDetails} disabled={disabled} style={styles.cardPressable}>
        <View style={styles.cardMetaRow}>
          <Text style={[styles.metaLabel, { color: tertiary }]}>
            {t("attributionReview.provisionalLabel")}
          </Text>
          <ChevronRight size={16} color={tertiary} />
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: primary }]} numberOfLines={2}>
              {getTransactionDisplayName(item.transaction, t("common.unknown"))}
            </Text>
            <Text style={[styles.supportingCopy, { color: secondary }]}>{item.evidenceLabel}</Text>
          </View>
          <Text style={[styles.amount, { color: accentRed }]}>
            {formatSignedMoney(item.transaction.amount, item.transaction.type)}
          </Text>
        </View>

        <View style={styles.ownerColumn}>
          <View style={styles.ownerRow}>
            <Text style={[styles.ownerLabel, { color: secondary }]}>
              {t("attributionReview.currentOwner")}
            </Text>
            <Text style={[styles.ownerValue, { color: primary }]}>
              {item.currentAccount?.name ?? t("common.unknown")}
            </Text>
          </View>
          <View style={styles.ownerRow}>
            <Text style={[styles.ownerLabel, { color: secondary }]}>
              {t("attributionReview.suggestedOwner")}
            </Text>
            <Text style={[styles.ownerValue, { color: primary }]}>
              {item.suggestedAccount.name}
            </Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <ActionButton
          label={t("attributionReview.confirmOwner")}
          onPress={onConfirm}
          disabled={disabled}
        />
        <ActionButton
          label={t("attributionReview.chooseAnother")}
          onPress={onChooseAnother}
          variant="outline"
          disabled={disabled}
        />
        <ActionButton
          label={t("attributionReview.skip")}
          onPress={onSkip}
          variant="ghost"
          disabled={disabled}
        />
      </View>
    </View>
  );
}

export function AttributionQueueScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const { items, hasLoadedQueue, reloadQueue, service } = useAttributionReviewQueue({ db, userId });
  const { isBusy, run: guardedAction } = useAsyncGuard();
  const [skippedIds, setSkippedIds] = useState<readonly string[]>([]);

  const visibleItems = items.filter((item) => !skippedIds.includes(item.transaction.id));

  const handleConfirm = (transactionId: TransactionId) => {
    void guardedAction(async () => {
      if (!db || !userId) {
        return;
      }

      try {
        const result = service.confirmSuggestedOwner({ db, userId, transactionId });
        if (!result.success) {
          showErrorToast(t("attributionReview.errors.confirmFailed"));
          return;
        }

        await refreshTransactions(db, userId);
        reloadQueue();
      } catch {
        showErrorToast(t("attributionReview.errors.confirmFailed"));
      }
    });
  };

  return (
    <ScreenLayout
      title={t("attributionReview.queueTitle")}
      variant="sub"
      onBack={() => router.back()}
    >
      {hasLoadedQueue && visibleItems.length === 0 ? (
        <EmptyState
          title={t("attributionReview.emptyTitle")}
          subtitle={t("attributionReview.emptySubtitle")}
        />
      ) : (
        <FlashList
          data={visibleItems}
          keyExtractor={(item) => item.transaction.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottom + 28 }]}
          contentInsetAdjustmentBehavior="automatic"
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          ListHeaderComponent={
            <SummaryCard
              icon={Landmark}
              title={t("attributionReview.queueCount", { count: visibleItems.length })}
              subtitle={t("attributionReview.queueSubtitle")}
              tone="green"
            />
          }
          renderItem={({ item }) => (
            <AttributionQueueCard
              item={item}
              disabled={isBusy}
              onConfirm={() => handleConfirm(item.transaction.id)}
              onChooseAnother={() =>
                router.push({
                  pathname: "/link-suggested-account",
                  params: { fingerprint: item.suggestion.fingerprint },
                })
              }
              onOpenDetails={() =>
                router.push({
                  pathname: "/attribution-review",
                  params: { transactionId: item.transaction.id },
                } as never)
              }
              onSkip={() =>
                setSkippedIds((current) =>
                  current.includes(item.transaction.id)
                    ? current
                    : [...current, item.transaction.id]
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
    gap: 10,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    lineHeight: 22,
  },
  supportingCopy: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  amount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    textAlign: "right",
  },
  ownerColumn: {
    gap: 8,
  },
  ownerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  ownerLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  ownerValue: {
    flex: 1,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
});
