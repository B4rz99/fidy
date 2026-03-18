import { useRouter } from "expo-router";
import { useCallback } from "react";
import { MonthNavigator } from "@/features/calendar/components/MonthNavigator";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Plus, Wallet } from "@/shared/components/icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useBudgetStore } from "../store";
import { BudgetAlertBanner } from "./BudgetAlertBanner";
import { BudgetCard } from "./BudgetCard";
import { BudgetSummaryCard } from "./BudgetSummaryCard";
import { UpcomingBillsSection } from "./UpcomingBillsSection";

function AddBudgetButton({ onPress }: { readonly onPress: () => void }) {
  const primaryColor = useThemeColor("primary");
  const peachBg = useThemeColor("peachLight");
  const borderColor = useThemeColor("borderSubtle");

  return (
    <Pressable
      onPress={onPress}
      style={[styles.addButton, { backgroundColor: peachBg, borderColor }]}
    >
      <Plus size={20} color={primaryColor} />
    </Pressable>
  );
}

export function BudgetListScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const currentMonth = useBudgetStore((s) => s.currentMonth);
  const budgets = useBudgetStore((s) => s.budgets);
  const budgetProgress = useBudgetStore((s) => s.budgetProgress);
  const summary = useBudgetStore((s) => s.summary);
  const pendingAlerts = useBudgetStore((s) => s.pendingAlerts);
  const nextMonth = useBudgetStore((s) => s.nextMonth);
  const prevMonth = useBudgetStore((s) => s.prevMonth);
  const acknowledgeAlert = useBudgetStore((s) => s.acknowledgeAlert);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const monthAsDate = new Date(`${currentMonth}-01`);

  const handleAddBudget = () => {
    router.push("/create-budget");
  };

  const handleAutoSetup = () => {
    router.push("/auto-suggest-budgets");
  };

  const handleCreateManually = () => {
    router.push("/create-budget");
  };

  const handleBudgetPress = useCallback(
    (budgetId: string) => {
      router.push({ pathname: "/create-budget", params: { budgetId } });
    },
    [router]
  );

  const handleDismissAlert = useCallback(
    (budgetId: string, threshold: 80 | 100) => {
      acknowledgeAlert(budgetId, threshold);
    },
    [acknowledgeAlert]
  );

  const hasBudgets = budgets.length > 0;

  return (
    <ScreenLayout
      title={t("budgets.title")}
      rightActions={<AddBudgetButton onPress={handleAddBudget} />}
    >
      <View style={styles.content}>
        <MonthNavigator currentMonth={monthAsDate} onPrev={prevMonth} onNext={nextMonth} />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_CLEARANCE }]}
          showsVerticalScrollIndicator={false}
        >
          {hasBudgets ? (
            <View style={styles.budgetContent}>
              {pendingAlerts.map((alert) => (
                <BudgetAlertBanner
                  key={`${alert.budgetId}:${alert.threshold}`}
                  alert={alert}
                  onDismiss={handleDismissAlert}
                />
              ))}

              <BudgetSummaryCard
                totalBudgetCents={summary.totalBudgetCents}
                totalSpentCents={summary.totalSpentCents}
                percentUsed={summary.percentUsed}
              />

              {budgetProgress.map((progress) => (
                <BudgetCard
                  key={progress.budgetId}
                  progress={progress}
                  onPress={handleBudgetPress}
                />
              ))}

              <UpcomingBillsSection />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Wallet size={48} color={secondaryColor} />
              <Text style={[styles.emptyTitle, { color: primaryColor }]}>
                {t("budgets.empty.title")}
              </Text>
              <Text style={[styles.emptySubtitle, { color: secondaryColor }]}>
                {t("budgets.empty.subtitle")}
              </Text>
              <View style={styles.emptyActions}>
                <Pressable
                  style={[styles.autoSetupButton, { backgroundColor: accentGreen }]}
                  onPress={handleAutoSetup}
                >
                  <Text style={styles.autoSetupText}>{t("budgets.empty.autoSetup")}</Text>
                </Pressable>
                <Pressable onPress={handleCreateManually}>
                  <Text style={[styles.createManuallyText, { color: accentGreen }]}>
                    {t("budgets.empty.createManually")}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 12,
  },
  budgetContent: {
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  emptyActions: {
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  autoSetupButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    minHeight: 48,
  },
  autoSetupText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  createManuallyText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
