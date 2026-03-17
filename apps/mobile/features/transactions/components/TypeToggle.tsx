import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { TransactionType } from "../schema";

type TypeToggleProps = {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
};

export const TypeToggle = ({ value, onChange }: TypeToggleProps) => {
  const { t } = useTranslation();
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const secondary = useThemeColor("secondary");

  const handlePress = (type: TransactionType) => {
    if (type !== value) {
      Haptics.selectionAsync();
      onChange(type);
    }
  };

  return (
    <View className="h-10 w-56 flex-row rounded-full bg-peach-light p-[3px] dark:bg-peach-light-dark">
      <Pressable
        className="flex-1 items-center justify-center rounded-full"
        style={value === "expense" ? { backgroundColor: accentRed } : undefined}
        onPress={() => handlePress("expense")}
        accessibilityRole="button"
        accessibilityState={{ selected: value === "expense" }}
      >
        <Text
          className="font-poppins-semibold text-[14px]"
          style={{ color: value === "expense" ? "#FFFFFF" : secondary }}
        >
          {t("transactions.expense")}
        </Text>
      </Pressable>
      <Pressable
        className="flex-1 items-center justify-center rounded-full"
        style={value === "income" ? { backgroundColor: accentGreen } : undefined}
        onPress={() => handlePress("income")}
        accessibilityRole="button"
        accessibilityState={{ selected: value === "income" }}
      >
        <Text
          className="font-poppins-semibold text-[14px]"
          style={{ color: value === "income" ? "#FFFFFF" : secondary }}
        >
          {t("transactions.income")}
        </Text>
      </Pressable>
    </View>
  );
};
