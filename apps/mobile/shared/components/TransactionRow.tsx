import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import {
  ActionSheetIOS,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { SolidSurface } from "./SolidSurface";
import { ListRowSurface } from "./ListRowSurface";

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
  iconBgColor: _iconBgColor,
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
  const defaultIconColor = useThemeColor("tertiary");
  const iconColor = iconColorOverride ?? defaultIconColor;
  const { t } = useTranslation();
  const resolvedAmountTone = amountTone ?? (isPositive ? "positive" : "negative");
  const amountClassName = getAmountClassName(resolvedAmountTone);

  const handleLongPress = useCallback(() => {
    if (Platform.OS !== "ios") return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

  const hasActions = onEdit != null || onDelete != null;

  const content = (
    <ListRowSurface radius={8} minHeight={64} layoutStyle={styles.rowSurface}>
      <SolidSurface
        radius={12}
        padded={false}
        className="size-10 items-center justify-center rounded-icon"
        style={{ alignItems: "center", height: 40, justifyContent: "center", width: 40 }}
      >
        <Text style={{ color: iconColor }}>{icon}</Text>
      </SolidSurface>
      <View className="ml-3 flex-1">
        <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
          {name}
        </Text>
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
          {date ?? category}
        </Text>
      </View>
      <Text className={`font-poppins-semibold text-body ${amountClassName}`}>{amount}</Text>
    </ListRowSurface>
  );

  if (!hasActions) return content;

  return <Pressable onLongPress={handleLongPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  rowSurface: {
    alignItems: "center",
    flexDirection: "row",
    gap: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
