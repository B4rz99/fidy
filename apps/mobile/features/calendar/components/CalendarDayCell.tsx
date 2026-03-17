import { Check } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import type { Bill } from "../schema";

type Props = {
  day: number | null;
  date: Date | null;
  bills: Bill[];
  paidBillIds: ReadonlySet<string>;
  onDayPress: (date: Date) => void;
};

const MAX_VISIBLE_TAGS = 2;

export function CalendarDayCell({ day, date, bills, paidBillIds, onDayPress }: Props) {
  const primaryColor = useThemeColor("primary");
  const peachBg = useThemeColor("peachLight");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  if (day === null || !date) {
    return <View style={styles.cell} />;
  }

  const visibleBills = bills.slice(0, MAX_VISIBLE_TAGS);

  return (
    <Pressable style={styles.cell} onPress={() => onDayPress(date)}>
      <Text style={[styles.dayNumber, { color: primaryColor }]}>{day}</Text>
      {visibleBills.map((bill) => {
        const paid = paidBillIds.has(bill.id);
        return (
          <View
            key={bill.id}
            style={[styles.tag, { backgroundColor: paid ? accentGreenLight : peachBg }]}
          >
            {paid && <Check size={7} color={accentGreen} />}
            <Text
              style={[styles.tagText, { color: paid ? accentGreen : primaryColor }]}
              numberOfLines={1}
            >
              {bill.name}
            </Text>
          </View>
        );
      })}
      {bills.length > MAX_VISIBLE_TAGS && (
        <Text style={[styles.moreText, { color: tertiaryColor }]}>
          +{bills.length - MAX_VISIBLE_TAGS}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 80,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  dayNumber: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    marginBottom: 2,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginVertical: 1,
    maxWidth: "100%",
  },
  tagText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 8,
  },
  moreText: {
    fontSize: 8,
    fontFamily: "Poppins_500Medium",
  },
});
