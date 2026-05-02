import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useOptionalUserId } from "@/features/auth";
import {
  CalendarGrid,
  MonthNavigator,
  nextMonth,
  prevMonth,
  useCalendarStore,
} from "@/features/calendar";
import { ScreenLayout } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { Pressable, View } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { getDb } from "@/shared/db";
import { useTranslation } from "@/shared/hooks";
import { captureError } from "@/shared/lib";

export default function BillsCalendarScreen() {
  const { back, push } = useRouter();
  const { t } = useTranslation();
  const currentMonth = useCalendarStore((s) => s.currentMonth);
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const userId = useOptionalUserId();

  const handleNextMonth = useCallback(() => {
    if (!userId) return;
    void nextMonth(getDb(userId)).catch(captureError);
  }, [userId]);

  const handlePrevMonth = useCallback(() => {
    if (!userId) return;
    void prevMonth(getDb(userId)).catch(captureError);
  }, [userId]);

  return (
    <ScreenLayout
      title={t("calendar.title")}
      variant="sub"
      rightActions={
        <Pressable
          onPress={() => push("/add-bill")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("bills.addBill")}
        >
          <Plus size={24} color={Colors.light.card} />
        </Pressable>
      }
      onBack={() => back()}
    >
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
              push({ pathname: "/day-detail", params: { date: date.toISOString() } })
            }
          />
        </View>
      </View>
    </ScreenLayout>
  );
}
