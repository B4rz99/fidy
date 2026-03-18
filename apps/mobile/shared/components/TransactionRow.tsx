import { useCallback } from "react";
import type { LucideIcon } from "@/shared/components/icons";
import { ActionSheetIOS, Platform, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type TransactionRowProps = {
  icon: LucideIcon;
  iconBgColor?: string;
  name: string;
  date?: string;
  amount: string;
  category: string;
  isPositive?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function TransactionRow({
  icon: Icon,
  iconBgColor,
  name,
  date,
  amount,
  category,
  isPositive = false,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const defaultIconBg = useThemeColor("peachLight");
  const iconColor = useThemeColor("tertiary");
  const { t } = useTranslation();

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

  const hasActions = (onEdit || onDelete) && Platform.OS === "ios";

  const content = (
    <View className="flex-row items-center py-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-icon"
        style={{ backgroundColor: iconBgColor ?? defaultIconBg }}
      >
        <Icon size={20} color={iconColor} />
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
        <Text
          className={`font-poppins-semibold text-body ${
            isPositive
              ? "text-accent-green dark:text-accent-green-dark"
              : "text-accent-red dark:text-accent-red-dark"
          }`}
        >
          {amount}
        </Text>
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
          {category}
        </Text>
      </View>
    </View>
  );

  if (!hasActions) return content;

  return <Pressable onLongPress={handleLongPress}>{content}</Pressable>;
}
