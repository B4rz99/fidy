import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useAuthStore } from "@/features/auth";
import {
  CalendarGrid,
  MonthNavigator,
  nextMonth,
  prevMonth,
  useCalendarStore,
} from "@/features/calendar";
import { ScreenLayout } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useTranslation } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";

export default function BillsCalendarScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const currentMonth = useCalendarStore((s) => s.currentMonth);
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const userId = useAuthStore((s) => s.session?.user.id ?? null) as UserId | null;

  const handleNextMonth = useCallback(() => {
    if (!userId) return;
    void nextMonth(getDb(userId)).catch(captureError);
  }, [userId]);

  const handlePrevMonth = useCallback(() => {
    if (!userId) return;
    void prevMonth(getDb(userId)).catch(captureError);
  }, [userId]);

  return (
    <ScreenLayout title={t("calendar.title")} variant="sub" onBack={() => router.back()}>
      <View className="flex-1 px-4">
        <MonthNavigator
          currentMonth={currentMonth}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
        />
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
