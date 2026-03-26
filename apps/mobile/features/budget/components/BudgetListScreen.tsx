import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { MonthNavigator } from "@/features/calendar/components/MonthNavigator";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Plus, Wallet } from "@/shared/components/icons";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useBudgetStore } from "../store";
import { BudgetCard } from "./BudgetCard";
import { BudgetSummaryCard } from "./BudgetSummaryCard";
import { UpcomingBillsSection } from "./UpcomingBillsSection";

function AddBudgetButton({ onPress }: { readonly onPress: () => void }) {
  const primaryColor = useThemeColor("primary");

  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Plus size={24} color={primaryColor} />
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
  const nextMonth = useBudgetStore((s) => s.nextMonth);
  const prevMonth = useBudgetStore((s) => s.prevMonth);
  const pendingPermissionRequest = useBudgetStore((s) => s.pendingPermissionRequest);
  const clearPendingPermissionRequest = useBudgetStore((s) => s.clearPendingPermissionRequest);

  // Navigate to pre-permission screen when store signals it.
  // Uses useEffect because the store's refreshProgress() is async/deep in the derivation
  // chain and cannot call router.push() directly — this is a Zustand subscription pattern.
  useEffect(() => {
    if (pendingPermissionRequest) {
      clearPendingPermissionRequest();
      router.push("/enable-notifications");
    }
  }, [pendingPermissionRequest, clearPendingPermissionRequest, router]);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const monthAsDate = new Date(
    Number.parseInt(currentMonth.slice(0, 4), 10),
    Number.parseInt(currentMonth.slice(5, 7), 10) - 1,
    1
  );

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

  const hasBudgets = budgets.length > 0;

  return (
    <ScreenLayout
      title={t("budgets.title")}
      rightActions={
        Platform.OS !== "ios" ? <AddBudgetButton onPress={handleAddBudget} /> : undefined
      }
    >
      <View style={styles.content}>
        <MonthNavigator currentMonth={monthAsDate} onPrev={prevMonth} onNext={nextMonth} />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_CLEARANCE }]}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          {hasBudgets ? (
            <View style={styles.budgetContent}>
              <BudgetSummaryCard
                totalBudget={summary.totalBudget}
                totalSpent={summary.totalSpent}
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
