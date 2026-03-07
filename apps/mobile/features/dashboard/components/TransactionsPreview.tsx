import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { Ellipsis } from "lucide-react-native";
import { useCallback } from "react";
import { View } from "react-native";
import { CATEGORY_MAP } from "@/features/transactions/lib/categories";
import { formatSignedAmount } from "@/features/transactions/lib/format-amount";
import type { StoredTransaction } from "@/features/transactions/schema";
import { useTransactionStore } from "@/features/transactions/store";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { TransactionRow } from "@/shared/components/TransactionRow";

const PREVIEW_LIMIT = 5;

export const TransactionsPreview = () => {
  const transactions = useTransactionStore((s) => s.transactions);
  const previewTransactions = transactions.slice(0, PREVIEW_LIMIT);

  const renderItem = useCallback(({ item: tx }: { item: StoredTransaction }) => {
    const category = CATEGORY_MAP[tx.categoryId];
    return (
      <TransactionRow
        icon={category?.icon ?? Ellipsis}
        name={tx.description || "Unknown"}
        date={format(tx.date, "MMM d, yyyy")}
        amount={formatSignedAmount(tx.amountCents, tx.type)}
        category={category?.label.en ?? "Other"}
        isPositive={tx.type === "income"}
      />
    );
  }, []);

  const keyExtractor = useCallback((item: StoredTransaction) => item.id, []);

  return (
    <View className="gap-1">
      <SectionHeader title="Transactions" actionLabel="See all" />
      <FlashList
        data={previewTransactions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        scrollEnabled={false}
      />
    </View>
  );
};
