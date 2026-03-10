import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useCalendarStore } from "../store";
import { CalendarGrid } from "./CalendarGrid";
import { MonthNavigator } from "./MonthNavigator";

export function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentMonth = useCalendarStore((s) => s.currentMonth);
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const nextMonth = useCalendarStore((s) => s.nextMonth);
  const prevMonth = useCalendarStore((s) => s.prevMonth);

  const pageBg = useThemeColor("page");
  const primaryColor = useThemeColor("primary");
  const peachBg = useThemeColor("peachLight");
  const borderColor = useThemeColor("borderSubtle");

  const handleDayPress = (date: Date) => {
    router.push({ pathname: "/day-detail", params: { date: date.toISOString() } });
  };

  const handleAddBill = () => {
    router.push("/add-bill");
  };

  return (
    <View style={[styles.container, { backgroundColor: pageBg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: primaryColor }]}>Calendar</Text>
        <Pressable
          style={[styles.addButton, { backgroundColor: peachBg, borderColor }]}
          onPress={handleAddBill}
        >
          <Plus size={20} color={primaryColor} />
        </Pressable>
      </View>

      {/* Month navigator */}
      <MonthNavigator currentMonth={currentMonth} onPrev={prevMonth} onNext={nextMonth} />

      {/* Calendar grid */}
      <View style={styles.gridWrapper}>
        <CalendarGrid
          currentMonth={currentMonth}
          bills={bills}
          payments={payments}
          onDayPress={handleDayPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gridWrapper: {
    flex: 1,
  },
});
