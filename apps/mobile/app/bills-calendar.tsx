import { useHeaderHeight } from "@react-navigation/elements";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import {
  deleteBill,
  markBillPaid,
  nextMonth,
  prevMonth,
  unmarkBillPaid,
  useCalendarStore,
} from "@/features/calendar/routes.public";
import {
  CalendarMonthBoard,
  type Bill,
  type CalendarBillOccurrence,
} from "@/features/calendar/ui.public";
import { ScreenLayout } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { Alert, Platform, Pressable } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { getDb } from "@/shared/db";
import { useTranslation } from "@/shared/hooks";
import { captureError, toIsoDate } from "@/shared/lib";
import { requireBillId, requireIsoDate } from "@/shared/types/assertions";

export default function BillsCalendarScreen() {
  const { back, push } = useRouter();
  const { t } = useTranslation();
  const currentMonth = useCalendarStore((s) => s.currentMonth);
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const userId = useOptionalUserId();
  const headerHeight = useHeaderHeight();
  const headerClearance = Platform.OS === "ios" ? headerHeight : 0;

  const handleNextMonth = useCallback(() => {
    if (!userId) return;
    void nextMonth(getDb(userId)).catch(captureError);
  }, [userId]);

  const handlePrevMonth = useCallback(() => {
    if (!userId) return;
    void prevMonth(getDb(userId)).catch(captureError);
  }, [userId]);

  const handleToggleBillPaid = useCallback(
    (occurrence: CalendarBillOccurrence) => {
      if (!userId) return;
      const command = {
        db: getDb(userId),
        userId,
        billId: requireBillId(occurrence.bill.id),
        dueDate: requireIsoDate(occurrence.dueDate),
      };
      const action = occurrence.isPaid ? unmarkBillPaid(command) : markBillPaid(command);
      void action.catch(captureError);
    },
    [userId]
  );

  const handleEditBill = useCallback(
    (bill: Bill) => {
      push({ pathname: "/add-bill", params: { billId: bill.id } });
    },
    [push]
  );

  const handleDeleteBill = useCallback(
    (bill: Bill) => {
      Alert.alert(t("bills.deleteBill"), t("bills.deleteBillConfirm", { billName: bill.name }), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            if (!userId) return;
            void deleteBill({
              db: getDb(userId),
              userId,
              billId: requireBillId(bill.id),
            }).catch(captureError);
          },
        },
      ]);
    },
    [t, userId]
  );

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
      <CalendarMonthBoard
        currentMonth={currentMonth}
        bills={bills}
        payments={payments}
        onBillDelete={handleDeleteBill}
        onBillEdit={handleEditBill}
        onBillPaymentToggle={handleToggleBillPaid}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        paddingTop={headerClearance}
        onDayPress={(date) => push({ pathname: "/day-detail", params: { date: toIsoDate(date) } })}
      />
    </ScreenLayout>
  );
}
