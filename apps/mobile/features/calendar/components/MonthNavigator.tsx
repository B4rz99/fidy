import { ChevronLeft, ChevronRight } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { formatMonthYear } from "../lib/calendar-utils";

type Props = {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
};

export function MonthNavigator({ currentMonth, onPrev, onNext }: Props) {
  const primaryColor = useThemeColor("primary");

  return (
    <View style={styles.container}>
      <Pressable onPress={onPrev} hitSlop={12}>
        <ChevronLeft size={24} color={primaryColor} />
      </Pressable>
      <Text style={[styles.monthText, { color: primaryColor }]}>
        {formatMonthYear(currentMonth)}
      </Text>
      <Pressable onPress={onNext} hitSlop={12}>
        <ChevronRight size={24} color={primaryColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  monthText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
  },
});
