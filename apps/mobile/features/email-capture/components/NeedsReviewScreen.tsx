import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTransactionStore } from "@/features/transactions/store";
import { useEmailCaptureStore } from "../store";
import { NeedsReviewCard } from "./NeedsReviewCard";

export default function NeedsReviewScreen() {
  const insets = useSafeAreaInsets();
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
    <View
      className="flex-1 bg-page dark:bg-page-dark"
      style={{ paddingTop: Platform.OS === "android" ? insets.top : insets.top }}
    >
      <View className="flex-row items-center px-5 pb-4 pt-2" style={{ gap: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1A1A1A" />
        </Pressable>
        <Text className="font-poppins-semibold text-lg text-primary dark:text-primary-dark">
          Review Transactions
        </Text>
      </View>

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
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
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
    </View>
  );
}
