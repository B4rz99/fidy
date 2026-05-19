import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import { refreshTransactions } from "@/features/transactions/store.public";
import { ScreenLayout } from "@/shared/components";
import { Landmark } from "@/shared/components/icons";
import { StyleSheet, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";
import type { TransactionId } from "@/shared/types/branded";
import { useAttributionReviewQueue } from "../hooks/use-attribution-review-queue";
import { AttributionQueueCard } from "./AttributionQueueCard";
import { EmptyState, SummaryCard } from "./shared";

const transactionKeyExtractor = (
  item: ReturnType<typeof useAttributionReviewQueue>["items"][number]
) => item.transaction.id;

const QueueItemSeparator = () => <View style={styles.itemSeparator} />;

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

  const handleConfirm = useCallback(
    (transactionId: TransactionId) => {
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
    },
    [db, guardedAction, reloadQueue, service, t, userId]
  );

  const handleChooseAnother = useCallback(
    (fingerprint: string) => {
      router.push({
        pathname: "/link-suggested-account",
        params: { fingerprint },
      });
    },
    [router]
  );

  const handleOpenDetails = useCallback(
    (transactionId: TransactionId) => {
      router.push({
        pathname: "/attribution-review",
        params: { transactionId },
      } as never);
    },
    [router]
  );

  const handleSkip = useCallback((transactionId: TransactionId) => {
    setSkippedIds((current) =>
      current.includes(transactionId) ? current : [...current, transactionId]
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: (typeof visibleItems)[number] }) => (
      <AttributionQueueCard
        item={item}
        disabled={isBusy}
        onConfirm={handleConfirm}
        onChooseAnother={handleChooseAnother}
        onOpenDetails={handleOpenDetails}
        onSkip={handleSkip}
      />
    ),
    [handleChooseAnother, handleConfirm, handleOpenDetails, handleSkip, isBusy]
  );

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
          keyExtractor={transactionKeyExtractor}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottom + 28 }]}
          contentInsetAdjustmentBehavior="automatic"
          ItemSeparatorComponent={QueueItemSeparator}
          ListHeaderComponent={
            <SummaryCard
              icon={Landmark}
              title={t("attributionReview.queueCount", { count: visibleItems.length })}
              subtitle={t("attributionReview.queueSubtitle")}
              tone="green"
            />
          }
          renderItem={renderItem}
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
  itemSeparator: {
    height: 14,
  },
});
