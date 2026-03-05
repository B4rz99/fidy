import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import type { Bill } from "../schema";

type Props = {
  day: number | null;
  bills: Bill[];
  onBillPress: (id: string) => void;
};

const MAX_VISIBLE_TAGS = 2;

export function CalendarDayCell({ day, bills, onBillPress }: Props) {
  const primaryColor = useThemeColor("primary");
  const peachBg = useThemeColor("peachLight");
  const tertiaryColor = useThemeColor("tertiary");

  if (day === null) {
    return <View style={styles.cell} />;
  }

  const visibleBills = bills.slice(0, MAX_VISIBLE_TAGS);

  return (
    <View style={styles.cell}>
      <Text style={[styles.dayNumber, { color: primaryColor }]}>{day}</Text>
      {visibleBills.map((bill) => (
        <Pressable
          key={bill.id}
          style={[styles.tag, { backgroundColor: peachBg }]}
          onPress={() => onBillPress(bill.id)}
        >
          <Text style={[styles.tagText, { color: primaryColor }]} numberOfLines={1}>
            {bill.name}
          </Text>
        </Pressable>
      ))}
      {bills.length > MAX_VISIBLE_TAGS && (
        <Text style={[styles.moreText, { color: tertiaryColor }]}>
          +{bills.length - MAX_VISIBLE_TAGS}
        </Text>
      )}
    </View>
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
