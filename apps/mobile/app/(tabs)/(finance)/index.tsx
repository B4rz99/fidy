import { Stack } from "expo-router";
import { useState } from "react";
import { AnalyticsScreen } from "@/features/analytics";
import { BudgetListScreen } from "@/features/budget";
import { GoalsListScreen } from "@/features/goals";
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

  const tabs: ReadonlyArray<{ key: FinanceTab; label: string }> = [
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
          <Text
            style={[styles.segmentText, { color: active === tab.key ? "#FFFFFF" : secondary }]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function FinanceScreen() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("budgets");

  return (
    <View style={styles.container}>
      {Platform.OS === "ios" && (
        <Stack.Screen
          options={{
            headerTitle: () => <SegmentControl active={activeTab} onSwitch={setActiveTab} />,
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
