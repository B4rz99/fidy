import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";
import { ScreenLayout } from "@/shared/components/ScreenLayout";
import { useTransactionStore } from "@/features/transactions/store";
import { useEmailCaptureStore } from "../store";
import { NeedsReviewCard } from "./NeedsReviewCard";

export default function NeedsReviewScreen() {
  const router = useRouter();
  const needsReview = useEmailCaptureStore((s) => s.needsReviewEmails);
  const confirmReview = useEmailCaptureStore((s) => s.confirmReview);
  const transactions = useTransactionStore((s) => s.transactions);

  const handleConfirm = useCallback(
    (processedEmailId: string, categoryId: string) => {
      confirmReview(processedEmailId, categoryId);
    },
    [confirmReview]
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof needsReview)[number] }) => {
      const tx = transactions.find((t) => t.id === item.transactionId);
      return <NeedsReviewCard processedEmail={item} transaction={tx} onConfirm={handleConfirm} />;
    },
    [transactions, handleConfirm]
  );

  const keyExtractor = useCallback((item: (typeof needsReview)[number]) => item.id, []);

  return (
    <ScreenLayout title="Review Transactions" variant="sub" onBack={() => router.back()}>
      {needsReview.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="font-poppins-semibold text-base text-primary dark:text-primary-dark">
            All caught up!
          </Text>
          <Text className="mt-1 text-center font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
            No transactions need review right now.
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
                {needsReview.length}{" "}
                {needsReview.length === 1 ? "transaction needs" : "transactions need"} review
              </Text>
              <Text className="font-poppins-medium text-caption" style={{ color: "#6D6D6D" }}>
                These were parsed with low confidence. Please confirm or correct the category.
              </Text>
            </View>
          }
        />
      )}
    </ScreenLayout>
  );
}
