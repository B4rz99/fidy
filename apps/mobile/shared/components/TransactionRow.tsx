import { Ellipsis } from "lucide-react-native";
import { memo } from "react";
import { Text, View } from "react-native";
import { CATEGORY_MAP, type CategoryId } from "@/features/transactions/lib/categories";
import { formatSignedAmount } from "@/features/transactions/lib/format-amount";
import type { TransactionType } from "@/features/transactions/schema";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

type TransactionRowProps = {
  description: string;
  amountCents: number;
  type: TransactionType;
  categoryId: CategoryId;
  dateLabel: string;
};

export const TransactionRow = memo(function TransactionRow({
  description,
  amountCents,
  type,
  categoryId,
  dateLabel,
}: TransactionRowProps) {
  const defaultIconBg = useThemeColor("peachLight");
  const iconColor = useThemeColor("tertiary");
  const category = CATEGORY_MAP[categoryId];
  const Icon = category?.icon ?? Ellipsis;

  return (
    <View className="flex-row items-center py-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-icon"
        style={{ backgroundColor: defaultIconBg }}
      >
        <Icon size={20} color={iconColor} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="font-poppins-medium text-body text-primary dark:text-primary-dark">
          {description || "Unknown"}
        </Text>
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
          {dateLabel}
        </Text>
      </View>
      <View className="items-end">
        <Text
          className={`font-poppins-semibold text-body ${
            type === "income"
              ? "text-accent-green dark:text-accent-green-dark"
              : "text-accent-red dark:text-accent-red-dark"
          }`}
        >
          {formatSignedAmount(amountCents, type)}
        </Text>
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
          {category?.label.en ?? "Other"}
        </Text>
      </View>
    </View>
  );
});
