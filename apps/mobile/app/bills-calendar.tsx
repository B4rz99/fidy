import { useRouter } from "expo-router";
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
import { AddActionButton, ScreenLayout } from "@/shared/components";
import { Alert, Platform } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useTranslation } from "@/shared/hooks";
import { captureError, toIsoDate } from "@/shared/lib";
import { useNativeHeaderHeight } from "@/shared/navigation/use-native-header-height";
import { requireBillId, requireIsoDate } from "@/shared/types/assertions";

export default function BillsCalendarScreen() {
  const { back, push } = useRouter();
  const { t } = useTranslation();
  const currentMonth = useCalendarStore((s) => s.currentMonth);
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const userId = useOptionalUserId();
  const nativeHeaderHeight = useNativeHeaderHeight();
  const headerClearance = Platform.OS === "ios" ? nativeHeaderHeight : 0;

  const handleNextMonth = () => {
    if (!userId) return;
    void nextMonth(getDb(userId)).catch(captureError);
  };

  const handlePrevMonth = () => {
    if (!userId) return;
    void prevMonth(getDb(userId)).catch(captureError);
  };

  const handleToggleBillPaid = (occurrence: CalendarBillOccurrence) => {
    if (!userId) return;
    const command = {
      db: getDb(userId),
      userId,
      billId: requireBillId(occurrence.bill.id),
      dueDate: requireIsoDate(occurrence.dueDate),
    };
    const action = occurrence.isPaid ? unmarkBillPaid(command) : markBillPaid(command);
    void action.catch(captureError);
  };

  const handleEditBill = (bill: Bill) => {
    push({ pathname: "/add-bill", params: { billId: bill.id } });
  };

  const handleDeleteBill = (bill: Bill) => {
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
  };

  return (
    <ScreenLayout
      title={t("calendar.title")}
      variant="sub"
      rightActions={
        <AddActionButton
          onPress={() => push("/add-bill")}
          accessibilityLabel={t("bills.addBill")}
        />
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
