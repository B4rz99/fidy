import { ChevronLeft, ChevronRight } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type HeaderMonthButtonProps = {
  readonly accessibilityHint: string;
  readonly accessibilityLabel: string;
  readonly color: string;
  readonly direction: "next" | "prev";
  readonly onPress: () => void;
};

function HeaderMonthButton({
  accessibilityHint,
  accessibilityLabel,
  color,
  direction,
  onPress,
}: HeaderMonthButtonProps) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={12}
      style={styles.headerMonthButton}
    >
      <Icon size={22} color={color} />
    </Pressable>
  );
}

type Props = {
  readonly monthLabel: string;
  readonly nextMonthHint: string;
  readonly nextMonthLabel: string;
  readonly onNext: () => void;
  readonly onPrev: () => void;
  readonly prevMonthHint: string;
  readonly prevMonthLabel: string;
};

export function BudgetHeaderMonthNavigator({
  monthLabel,
  nextMonthHint,
  nextMonthLabel,
  onNext,
  onPrev,
  prevMonthHint,
  prevMonthLabel,
}: Props) {
  const primaryColor = useThemeColor("primary");

  return (
    <View style={styles.headerMonthNavigator}>
      <HeaderMonthButton
        accessibilityHint={prevMonthHint}
        accessibilityLabel={prevMonthLabel}
        color={primaryColor}
        direction="prev"
        onPress={onPrev}
      />
      <Text style={[styles.headerMonthText, { color: primaryColor }]} numberOfLines={1}>
        {monthLabel}
      </Text>
      <HeaderMonthButton
        accessibilityHint={nextMonthHint}
        accessibilityLabel={nextMonthLabel}
        color={primaryColor}
        direction="next"
        onPress={onNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerMonthNavigator: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  headerMonthButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 32,
  },
  headerMonthText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    textAlign: "center",
  },
});
