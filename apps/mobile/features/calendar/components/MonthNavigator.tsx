import { ChevronLeft, ChevronRight } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatMonthYear } from "../lib/calendar-utils";

type Props = {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
};

export function MonthNavigator({ currentMonth, onPrev, onNext }: Props) {
  const { locale, t } = useTranslation();
  const primaryColor = useThemeColor("primary");

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPrev}
        hitSlop={12}
        style={styles.previousButton}
        accessibilityRole="button"
        accessibilityLabel={t("calendar.previousMonth")}
      >
        <ChevronLeft size={24} color={primaryColor} />
      </Pressable>
      <Text style={[styles.monthText, { color: primaryColor }]}>
        {formatMonthYear(currentMonth, getDateFnsLocale(locale))}
      </Text>
      <Pressable
        onPress={onNext}
        hitSlop={12}
        style={styles.nextButton}
        accessibilityRole="button"
        accessibilityLabel={t("calendar.nextMonth")}
      >
        <ChevronRight size={24} color={primaryColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  previousButton: {
    left: 8,
    position: "absolute",
  },
  nextButton: {
    position: "absolute",
    right: 8,
  },
  monthText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
  },
});
