import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTransactionStore } from "@/features/transactions";
import { ScreenLayout } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { useEmailCaptureStore } from "../store";
import { NeedsReviewCard } from "./NeedsReviewCard";

export default function NeedsReviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const needsReview = useEmailCaptureStore((s) => s.needsReviewEmails);
  const confirmReview = useEmailCaptureStore((s) => s.confirmReview);
  const getTransaction = useTransactionStore((s) => s.getTransactionById);

  // Pre-fetch all needed transactions once, not per-cell
  const txMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getTransaction>>();
    needsReview.forEach((item) => {
      if (item.transactionId) {
        map.set(item.transactionId, getTransaction(item.transactionId));
      }
    });
    return map;
  }, [needsReview, getTransaction]);

  const handleConfirm = useCallback(
    (processedEmailId: string, categoryId: string) => {
      confirmReview(processedEmailId, categoryId);
    },
    [confirmReview]
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof needsReview)[number] }) => {
      const tx = item.transactionId ? txMap.get(item.transactionId) : null;
      return (
        <NeedsReviewCard
          processedEmail={item}
          transaction={tx ?? undefined}
          onConfirm={handleConfirm}
        />
      );
    },
    [txMap, handleConfirm]
  );

  const keyExtractor = useCallback((item: (typeof needsReview)[number]) => item.id, []);

  return (
    <ScreenLayout title={t("needsReview.title")} variant="sub" onBack={() => router.back()}>
      {needsReview.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="font-poppins-semibold text-base text-primary dark:text-primary-dark">
            {t("needsReview.allCaughtUp")}
          </Text>
          <Text className="mt-1 text-center font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
            {t("needsReview.noReviewNeeded")}
          </Text>
        </View>
      ) : (
        <FlashList
          data={needsReview}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListHeaderComponent={
            <View className="mb-4 rounded-xl p-3" style={{ backgroundColor: "#FFF3E0" }}>
              <Text className="font-poppins-semibold text-sm text-primary dark:text-primary-dark">
                {t("needsReview.count", { count: needsReview.length })}
              </Text>
              <Text className="font-poppins-medium text-caption" style={{ color: "#6D6D6D" }}>
                {t("needsReview.lowConfidenceHint")}
              </Text>
            </View>
          }
        />
      )}
    </ScreenLayout>
  );
}
