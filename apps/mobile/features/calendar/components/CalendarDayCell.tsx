import { GlassPressable } from "@/shared/components";
import { StyleSheet, Text, View } from "@/shared/components/rn";
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

  if (day === null || !date) {
    return <View style={[styles.cellLayout, minHeight != null ? { minHeight } : undefined]} />;
  }

  const visibleBills = bills.slice(0, MAX_VISIBLE_DOTS);

  return (
    <GlassPressable
      style={[styles.cellLayout, minHeight != null ? { minHeight } : undefined]}
      layoutStyle={styles.cellSurface}
      radius={8}
      padded={false}
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
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  cellLayout: {
    flex: 1,
    minHeight: 72,
    margin: 2,
  },
  cellSurface: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: "center",
    borderRadius: 8,
    borderCurve: "continuous",
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
