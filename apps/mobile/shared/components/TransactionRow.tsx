import { useCallback } from "react";
import { ActionSheetIOS, Platform, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type TransactionRowProps = {
  icon: string;
  iconBgColor?: string;
  iconColor?: string;
  name: string;
  date?: string;
  amount: string;
  category: string;
  isPositive?: boolean;
  amountTone?: "positive" | "negative" | "neutral";
  onEdit?: () => void;
  onDelete?: () => void;
};

function getAmountClassName(amountTone: NonNullable<TransactionRowProps["amountTone"]>): string {
  if (amountTone === "positive") return "text-accent-green dark:text-accent-green-dark";
  if (amountTone === "neutral") return "text-primary dark:text-primary-dark";
  return "text-accent-red dark:text-accent-red-dark";
}

export function TransactionRow({
  icon,
  iconBgColor,
  iconColor: iconColorOverride,
  name,
  date,
  amount,
  category,
  isPositive = false,
  amountTone,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const defaultIconBg = useThemeColor("peachLight");
  const defaultIconColor = useThemeColor("tertiary");
  const iconColor = iconColorOverride ?? defaultIconColor;
  const { t } = useTranslation();
  const resolvedAmountTone = amountTone ?? (isPositive ? "positive" : "negative");
  const amountClassName = getAmountClassName(resolvedAmountTone);

  const handleLongPress = useCallback(() => {
    if (Platform.OS !== "ios") return;

    const options = [
      ...(onEdit ? [t("common.edit")] : []),
      ...(onDelete ? [t("common.delete")] : []),
      t("common.cancel"),
    ];
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = onDelete ? options.indexOf(t("common.delete")) : undefined;

    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex, destructiveButtonIndex },
      (buttonIndex) => {
        const selected = options[buttonIndex];
        if (selected === t("common.edit")) onEdit?.();
        if (selected === t("common.delete")) onDelete?.();
      }
    );
  }, [onEdit, onDelete, t]);

  const hasActions = (onEdit != null || onDelete != null) && Platform.OS === "ios";

  const content = (
    <View className="flex-row items-center py-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-icon"
        style={{ backgroundColor: iconBgColor ?? defaultIconBg }}
      >
        <Text style={{ color: iconColor }}>{icon}</Text>
      </View>
      <View className="ml-3 flex-1">
        <Text className="font-poppins-medium text-body text-primary dark:text-primary-dark">
          {name}
        </Text>
        {date != null && (
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
            {date}
          </Text>
        )}
      </View>
      <View className="items-end">
        <Text className={`font-poppins-semibold text-body ${amountClassName}`}>{amount}</Text>
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
          {category}
        </Text>
      </View>
    </View>
  );

  if (!hasActions) return content;

  return <Pressable onLongPress={handleLongPress}>{content}</Pressable>;
}
