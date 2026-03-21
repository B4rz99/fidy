import { Stack } from "expo-router";
import { useState } from "react";
import { BudgetListScreen } from "@/features/budget";
import { GoalsListScreen } from "@/features/goals";
import { Platform, Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

type FinanceTab = "budgets" | "goals";

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

  return (
    <View style={[styles.segmentContainer, { backgroundColor: card }]}>
      <Pressable
        style={[
          styles.segmentButton,
          active === "budgets" ? { backgroundColor: accentGreen } : undefined,
        ]}
        onPress={() => onSwitch("budgets")}
      >
        <Text style={[styles.segmentText, { color: active === "budgets" ? "#FFFFFF" : secondary }]}>
          {t("budgets.title")}
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.segmentButton,
          active === "goals" ? { backgroundColor: accentGreen } : undefined,
        ]}
        onPress={() => onSwitch("goals")}
      >
        <Text style={[styles.segmentText, { color: active === "goals" ? "#FFFFFF" : secondary }]}>
          {t("goals.title")}
        </Text>
      </Pressable>
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
      {activeTab === "budgets" ? <BudgetListScreen /> : <GoalsListScreen />}
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
    width: 220,
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
