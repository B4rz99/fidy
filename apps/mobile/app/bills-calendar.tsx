import { useRouter } from "expo-router";
import { useCalendarStore } from "@/features/calendar";
import { CalendarGrid } from "@/features/calendar/components/CalendarGrid";
import { MonthNavigator } from "@/features/calendar/components/MonthNavigator";
import { ScreenLayout } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";

export default function BillsCalendarScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const currentMonth = useCalendarStore((s) => s.currentMonth);
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const nextMonth = useCalendarStore((s) => s.nextMonth);
  const prevMonth = useCalendarStore((s) => s.prevMonth);

  return (
    <ScreenLayout title={t("calendar.title")} variant="sub" onBack={() => router.back()}>
      <View className="flex-1 px-4">
        <MonthNavigator currentMonth={currentMonth} onPrev={prevMonth} onNext={nextMonth} />
        <View className="flex-1">
          <CalendarGrid
            currentMonth={currentMonth}
            bills={bills}
            payments={payments}
            onDayPress={(date) =>
              router.push({ pathname: "/day-detail", params: { date: date.toISOString() } })
            }
          />
        </View>
      </View>
    </ScreenLayout>
  );
}
