import type { LucideIcon } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type TransactionRowProps = {
  icon: LucideIcon;
  iconBgColor?: string;
  name: string;
  date?: string;
  amount: string;
  category: string;
  isPositive?: boolean;
};

export function TransactionRow({
  icon: Icon,
  iconBgColor,
  name,
  date,
  amount,
  category,
  isPositive = false,
}: TransactionRowProps) {
  const defaultIconBg = useThemeColor("peachLight");
  const iconColor = useThemeColor("tertiary");

  return (
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
}
