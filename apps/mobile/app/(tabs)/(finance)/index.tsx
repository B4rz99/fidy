import { Stack, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import { GoalsListScreen } from "@/features/goals/ui.public";
import { AppAuroraBackground, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useColorScheme, useThemeColor, useTranslation } from "@/shared/hooks";
import { captureError, toIsoDate } from "@/shared/lib";
import { requireBillId, requireIsoDate } from "@/shared/types/assertions";

type FinanceTab = "calendar" | "goals" | "analytics";

const FINANCE_NATIVE_TAB_BAR_OFFSET = 72;
const FINANCE_IOS_HEADER_CONTENT_HEIGHT = 44;

function SegmentControl({
  active,
  onSwitch,
}: {
  active: FinanceTab;
  onSwitch: (tab: FinanceTab) => void;
}) {
  const { t } = useTranslation();
  const card = useThemeColor("card");
  const accentGreen = useThemeColor("accentGreen");
  const secondary = useThemeColor("secondary");

  const tabs: readonly { key: FinanceTab; label: string }[] = [
    { key: "analytics", label: t("analytics.title") },
    { key: "goals", label: t("goals.title") },
    { key: "calendar", label: t("calendar.title") },
  ];

  return (
    <View style={[styles.segmentContainer, { backgroundColor: card }]}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          style={[
            styles.segmentButton,
            active === tab.key ? { backgroundColor: accentGreen } : undefined,
          ]}
          onPress={() => onSwitch(tab.key)}
        >
          <Text style={[styles.segmentText, { color: active === tab.key ? "#FFFFFF" : secondary }]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
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
  const headerClearance =
    Platform.OS === "ios" ? insets.top + FINANCE_IOS_HEADER_CONTENT_HEIGHT : 0;
  const tabBarClearance =
    Platform.OS === "ios" ? insets.bottom + FINANCE_NATIVE_TAB_BAR_OFFSET : TAB_BAR_CLEARANCE;

  const handleNextMonth = useCallback(() => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void nextMonth(db).catch(captureError);
  }, [userId]);

  const handlePrevMonth = useCallback(() => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void prevMonth(db).catch(captureError);
  }, [userId]);

  const handleToggleBillPaid = useCallback(
    (occurrence: CalendarBillOccurrence) => {
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
    },
    [t, userId]
  );

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

function useHeaderRight(activeTab: FinanceTab) {
  const { push } = useRouter();
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const goals = useGoalStore((s) => s.goals);

  return useMemo(() => {
    if (activeTab === "calendar") {
      return function AddBillAction() {
        return (
          <Pressable
            onPress={() => push("/add-bill")}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("bills.addBill")}
          >
            <Plus size={24} color={primaryColor} />
          </Pressable>
        );
      };
    }
    if (activeTab === "goals" && goals.length > 0) {
      return function AddGoalAction() {
        return (
          <Pressable onPress={() => push("/create-goal")} hitSlop={12}>
            <Plus size={24} color={primaryColor} />
          </Pressable>
        );
      };
    }
    return function NoAction() {
      return null;
    };
  }, [activeTab, goals.length, primaryColor, push, t]);
}

export default function FinanceScreen() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("analytics");
  const headerRight = useHeaderRight(activeTab);
  const isDark = useColorScheme() === "dark";

  return (
    <View style={styles.container}>
      <AppAuroraBackground isDark={isDark} />
      {Platform.OS === "ios" && (
        <Stack.Screen
          options={{
            headerTitle: () => <SegmentControl active={activeTab} onSwitch={setActiveTab} />,
            headerRight,
          }}
        />
      )}
      {Platform.OS !== "ios" && (
        <View style={styles.androidSegmentWrap}>
          <SegmentControl active={activeTab} onSwitch={setActiveTab} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        {activeTab === "calendar" && <FinanceCalendarPanel />}
        {activeTab === "goals" && <GoalsListScreen />}
        {activeTab === "analytics" && <AnalyticsScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    width: 320,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    height: 32,
  },
  segmentText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  androidSegmentWrap: {
    alignItems: "center",
    paddingVertical: 8,
  },
  calendarPanel: {
    flex: 1,
  },
});
