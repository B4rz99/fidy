import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { AnalyticsScreen } from "@/features/analytics";
import { BudgetListScreen } from "@/features/budget";
import { GoalsListScreen } from "@/features/goals";
import { useGoalStore } from "@/features/goals";
import { Plus } from "@/shared/components/icons";
import { Platform, Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type FinanceTab = "budgets" | "goals" | "analytics";

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

function useHeaderRight(activeTab: FinanceTab) {
  const router = useRouter();
  const primaryColor = useThemeColor("primary");
  const accentGreen = useThemeColor("accentGreen");
  const goals = useGoalStore((s) => s.goals);

  return useMemo(() => {
    if (activeTab === "budgets") {
      return function AddBudgetAction() {
        return (
          <Pressable onPress={() => router.push("/create-budget")} hitSlop={12}>
            <Plus size={24} color={primaryColor} />
          </Pressable>
        );
      };
    }
    if (activeTab === "goals" && goals.length > 0) {
      return function AddGoalAction() {
        return (
          <Pressable onPress={() => router.push("/create-goal")} hitSlop={12}>
            <Plus size={24} color={accentGreen} />
          </Pressable>
        );
      };
    }
    return function NoAction() {
      return null;
    };
  }, [activeTab, goals.length, primaryColor, accentGreen, router]);
}

export default function FinanceScreen() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("budgets");
  const headerRight = useHeaderRight(activeTab);

  return (
    <View style={styles.container}>
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
    width: 300,
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
});
