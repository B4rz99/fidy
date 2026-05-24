import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import type { Bill } from "../schema";

type Props = {
  day: number | null;
  date: Date | null;
  bills: Bill[];
  paidBillIds: ReadonlySet<string>;
  minHeight?: number;
  onDayPress: (date: Date) => void;
};

const MAX_VISIBLE_DOTS = 4;

export function CalendarDayCell({ day, date, bills, paidBillIds, minHeight, onDayPress }: Props) {
  const primaryColor = useThemeColor("primary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const peach = useThemeColor("peach");
  const borderColor = useThemeColor("borderSubtle");

  if (day === null || !date) {
    return <View style={[styles.cell, minHeight != null ? { minHeight } : undefined]} />;
  }

  const visibleBills = bills.slice(0, MAX_VISIBLE_DOTS);
  const hasDueBills = bills.length > 0;

  return (
    <Pressable
      style={[
        styles.cell,
        hasDueBills ? { borderColor, borderWidth: 1 } : undefined,
        minHeight != null ? { minHeight } : undefined,
      ]}
      onPress={() => onDayPress(date)}
    >
      <Text style={[styles.dayNumber, { color: primaryColor }]}>{day}</Text>
      {visibleBills.length > 0 ? (
        <View style={styles.dots}>
          {visibleBills.map((bill) => {
            const paid = paidBillIds.has(bill.id);
            return (
              <View
                key={bill.id}
                style={[styles.dot, { backgroundColor: paid ? accentGreen : peach }]}
              />
            );
          })}
        </View>
      ) : null}
      {bills.length > MAX_VISIBLE_DOTS ? (
        <Text style={[styles.moreText, { color: tertiaryColor }]}>
          +{bills.length - MAX_VISIBLE_DOTS}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 72,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: "center",
    borderRadius: 8,
    borderCurve: "continuous",
    margin: 2,
  },
  dayNumber: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    marginBottom: 6,
  },
  dots: {
    minHeight: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  moreText: {
    marginTop: 2,
    fontSize: 8,
    fontFamily: "Poppins_600SemiBold",
  },
});
