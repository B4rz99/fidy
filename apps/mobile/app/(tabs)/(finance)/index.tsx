import { Stack, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { AnalyticsScreen } from "@/features/analytics";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import { BudgetListScreen } from "@/features/budget/ui.public";
import {
  CalendarGrid,
  MonthNavigator,
  nextMonth,
  prevMonth,
  useCalendarStore,
} from "@/features/calendar";
import { useGoalStore } from "@/features/goals/hooks.public";
import { GoalsListScreen } from "@/features/goals/ui.public";
import { TAB_BAR_CLEARANCE } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { Platform, Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { captureError } from "@/shared/lib";

type FinanceTab = "budgets" | "calendar" | "goals" | "analytics";

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
    { key: "budgets", label: t("budgets.title") },
    { key: "calendar", label: t("calendar.title") },
    { key: "goals", label: t("goals.title") },
    { key: "analytics", label: t("analytics.title") },
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
  const currentMonth = useCalendarStore((s) => s.currentMonth);
  const bills = useCalendarStore((s) => s.bills);
  const payments = useCalendarStore((s) => s.payments);
  const userId = useOptionalUserId();
  const pageBg = useThemeColor("page");

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

  return (
    <View style={[styles.calendarPanel, { backgroundColor: pageBg }]}>
      <MonthNavigator
        currentMonth={currentMonth}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
      />
      <View style={styles.calendarGridWrap}>
        <CalendarGrid
          currentMonth={currentMonth}
          bills={bills}
          payments={payments}
          cellMinHeight={54}
          onDayPress={(date) =>
            push({ pathname: "/day-detail", params: { date: date.toISOString() } })
          }
        />
      </View>
    </View>
  );
}

function useHeaderRight(activeTab: FinanceTab) {
  const { push } = useRouter();
  const primaryColor = useThemeColor("primary");
  const accentGreen = useThemeColor("accentGreen");
  const goals = useGoalStore((s) => s.goals);

  return useMemo(() => {
    if (activeTab === "budgets") {
      return function AddBudgetAction() {
        return (
          <Pressable onPress={() => push("/create-budget")} hitSlop={12}>
            <Plus size={24} color={primaryColor} />
          </Pressable>
        );
      };
    }
    if (activeTab === "goals" && goals.length > 0) {
      return function AddGoalAction() {
        return (
          <Pressable onPress={() => push("/create-goal")} hitSlop={12}>
            <Plus size={24} color={accentGreen} />
          </Pressable>
        );
      };
    }
    return function NoAction() {
      return null;
    };
  }, [activeTab, goals.length, primaryColor, accentGreen, push]);
}

export default function FinanceScreen() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("budgets");
  const headerRight = useHeaderRight(activeTab);
  const pageBg = useThemeColor("page");

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
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
      {activeTab === "budgets" && <BudgetListScreen />}
      {activeTab === "calendar" && <FinanceCalendarPanel />}
      {activeTab === "goals" && <GoalsListScreen />}
      {activeTab === "analytics" && <AnalyticsScreen />}
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
    width: 360,
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
    paddingHorizontal: 16,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  calendarGridWrap: {
    flex: 1,
  },
});
