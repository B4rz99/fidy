import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type FilterType = "all" | "expense" | "income";

type TypeFilterProps = {
  value: FilterType;
  onChange: (type: FilterType) => void;
};

export const TypeFilter = ({ value, onChange }: TypeFilterProps) => {
  const { t } = useTranslation();
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const secondary = useThemeColor("secondary");

  const handlePress = (type: FilterType) => {
    if (type !== value) {
      Haptics.selectionAsync();
      onChange(type);
    }
  };

  const getStyle = (type: FilterType) => {
    if (type !== value) return undefined;
    if (type === "expense") return { backgroundColor: accentRed };
    if (type === "income") return { backgroundColor: accentGreen };
    return { backgroundColor: secondary };
  };

  const getColor = (type: FilterType) => {
    if (type === value) return "#FFFFFF";
    return secondary;
  };

  return (
    <View className="h-10 flex-row rounded-full bg-peach-light p-[3px] dark:bg-peach-light-dark">
      <Pressable
        className="flex-1 items-center justify-center rounded-full"
        style={getStyle("all")}
        onPress={() => handlePress("all")}
        accessibilityRole="button"
        accessibilityState={{ selected: value === "all" }}
      >
        <Text className="font-poppins-semibold text-[14px]" style={{ color: getColor("all") }}>
          {t("search.allTypes")}
        </Text>
      </Pressable>
      <Pressable
        className="flex-1 items-center justify-center rounded-full"
        style={getStyle("expense")}
        onPress={() => handlePress("expense")}
        accessibilityRole="button"
        accessibilityState={{ selected: value === "expense" }}
      >
        <Text className="font-poppins-semibold text-[14px]" style={{ color: getColor("expense") }}>
          {t("transactions.expense")}
        </Text>
      </Pressable>
      <Pressable
        className="flex-1 items-center justify-center rounded-full"
        style={getStyle("income")}
        onPress={() => handlePress("income")}
        accessibilityRole="button"
        accessibilityState={{ selected: value === "income" }}
      >
        <Text className="font-poppins-semibold text-[14px]" style={{ color: getColor("income") }}>
          {t("transactions.income")}
        </Text>
      </Pressable>
    </View>
  );
};
