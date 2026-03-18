import * as ContextMenu from "zeego/context-menu";
import type { LucideIcon } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
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

  if (!onEdit && !onDelete) return content;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>{content}</ContextMenu.Trigger>
      <ContextMenu.Content>
        {onEdit && (
          <ContextMenu.Item key="edit" textValue={t("common.edit")} onSelect={onEdit}>
            <ContextMenu.ItemTitle>{t("common.edit")}</ContextMenu.ItemTitle>
            <ContextMenu.ItemIcon ios={{ name: "pencil" }} />
          </ContextMenu.Item>
        )}
        {onDelete && (
          <ContextMenu.Item
            key="delete"
            textValue={t("common.delete")}
            onSelect={onDelete}
            destructive
          >
            <ContextMenu.ItemTitle>{t("common.delete")}</ContextMenu.ItemTitle>
            <ContextMenu.ItemIcon ios={{ name: "trash" }} />
          </ContextMenu.Item>
        )}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}
