import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnalyticsScreen } from "@/features/analytics";
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
import { useGoalStore } from "@/features/goals/hooks.public";
import { GoalsListScreen } from "@/features/goals/routes.public";
import {
  AddActionButton,
  ScreenLayout,
  SegmentedControl,
  TAB_BAR_CLEARANCE,
} from "@/shared/components";
import { Alert, Platform, StyleSheet, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useTranslation } from "@/shared/hooks";
import { captureError, toIsoDate } from "@/shared/lib";
import { useNativeHeaderHeight } from "@/shared/navigation/use-native-header-height";
import { requireBillId, requireIsoDate } from "@/shared/types/assertions";

type FinanceTab = "calendar" | "goals" | "analytics";

const FINANCE_NATIVE_TAB_BAR_OFFSET = 72;

function SegmentControl({
  active,
  onSwitch,
}: {
  active: FinanceTab;
  onSwitch: (tab: FinanceTab) => void;
}) {
  const { t } = useTranslation();

  const tabs: readonly { value: FinanceTab; label: string }[] = [
    { value: "analytics", label: t("analytics.title") },
    { value: "goals", label: t("goals.title") },
    { value: "calendar", label: t("calendar.title") },
  ];

  return (
    <SegmentedControl
      options={tabs}
      value={active}
      onChange={onSwitch}
      tone="success"
      variant="detached"
      style={styles.headerSegment}
    />
  );
}

function FinanceCalendarPanel() {
  const { push } = useRouter();
  const { t } = useTranslation();
  const currentMonth = useCalendarStore((s) => s.currentMonth);
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const userId = useOptionalUserId();
  const insets = useSafeAreaInsets();
  const nativeHeaderHeight = useNativeHeaderHeight();
  const headerClearance = Platform.OS === "ios" ? nativeHeaderHeight : 0;
  const tabBarClearance =
    Platform.OS === "ios" ? insets.bottom + FINANCE_NATIVE_TAB_BAR_OFFSET : TAB_BAR_CLEARANCE;

  const handleNextMonth = () => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void nextMonth(db).catch(captureError);
  };

  const handlePrevMonth = () => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void prevMonth(db).catch(captureError);
  };

  const handleToggleBillPaid = (occurrence: CalendarBillOccurrence) => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    const command = {
      db,
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
          const db = tryGetDb(userId);
          if (!db) return;
          void deleteBill({
            db,
            userId,
            billId: requireBillId(bill.id),
          }).catch(captureError);
        },
      },
    ]);
  };

  return (
    <View style={styles.calendarPanel}>
      <CalendarMonthBoard
        currentMonth={currentMonth}
        bills={bills}
        payments={payments}
        cellMinHeight={54}
        paddingBottom={tabBarClearance}
        paddingTop={headerClearance}
        onBillDelete={handleDeleteBill}
        onBillEdit={handleEditBill}
        onBillPaymentToggle={handleToggleBillPaid}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onDayPress={(date) => push({ pathname: "/day-detail", params: { date: toIsoDate(date) } })}
      />
    </View>
  );
}

export default function FinanceScreen() {
  const { push } = useRouter();
  const { t } = useTranslation();
  const goals = useGoalStore((s) => s.goals);
  const [activeTab, setActiveTab] = useState<FinanceTab>("analytics");
  const rightAction = (() => {
    if (activeTab === "calendar") {
      return (
        <AddActionButton
          onPress={() => push("/add-bill")}
          accessibilityLabel={t("bills.addBill")}
        />
      );
    }

    if (activeTab === "goals" && goals.length > 0) {
      return (
        <AddActionButton
          onPress={() => push("/create-goal")}
          accessibilityLabel={t("goals.empty.createGoal")}
        />
      );
    }

    return undefined;
  })();

  return (
    <ScreenLayout
      includesNativeHeader={false}
      centerAction={<SegmentControl active={activeTab} onSwitch={setActiveTab} />}
      rightActions={rightAction}
    >
      <View style={{ flex: 1 }}>
        {activeTab === "calendar" && <FinanceCalendarPanel />}
        {activeTab === "goals" && <GoalsListScreen includesHeader={false} />}
        {activeTab === "analytics" && <AnalyticsScreen />}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerSegment: {
    width: "100%",
  },
  calendarPanel: {
    flex: 1,
  },
});
