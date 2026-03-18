import { Stack, useRouter } from "expo-router";
import { ScreenLayout } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { Platform, Pressable, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useCalendarStore } from "../store";
import { CalendarGrid } from "./CalendarGrid";
import { MonthNavigator } from "./MonthNavigator";

function AddBillButton({ onPress }: { readonly onPress: () => void }) {
  const primaryColor = useThemeColor("primary");
  const peachBg = useThemeColor("peachLight");
  const borderColor = useThemeColor("borderSubtle");

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor,
        backgroundColor: peachBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Plus size={20} color={primaryColor} />
    </Pressable>
  );
}

export function CalendarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const currentMonth = useCalendarStore((s) => s.currentMonth);
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const nextMonth = useCalendarStore((s) => s.nextMonth);
  const prevMonth = useCalendarStore((s) => s.prevMonth);

  const handleDayPress = (date: Date) => {
    router.push({ pathname: "/day-detail", params: { date: date.toISOString() } });
  };

  const handleAddBill = () => {
    router.push("/add-bill");
  };

  return (
    <ScreenLayout
      title={t("calendar.title")}
      rightActions={Platform.OS !== "ios" ? <AddBillButton onPress={handleAddBill} /> : undefined}
    >
      {Platform.OS === "ios" && (
        <Stack.Screen
          options={{
            title: t("calendar.title"),
            headerRight: () => <AddBillButton onPress={handleAddBill} />,
          }}
        />
      )}
      <View className="flex-1 px-4">
        <MonthNavigator currentMonth={currentMonth} onPrev={prevMonth} onNext={nextMonth} />
        <View className="flex-1">
          <CalendarGrid
            currentMonth={currentMonth}
            bills={bills}
            payments={payments}
            onDayPress={handleDayPress}
          />
        </View>
      </View>
    </ScreenLayout>
  );
}
