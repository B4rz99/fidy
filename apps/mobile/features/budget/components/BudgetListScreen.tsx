import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { MonthNavigator } from "@/features/calendar/public";
import { shouldShowNotificationPrePermissionPrompt } from "@/features/notifications/public";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Plus, Wallet } from "@/shared/components/icons";
import { Platform, Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useSubscription, useThemeColor, useTranslation } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { BudgetProgress } from "../lib/derive";
import { nextBudgetMonth, prevBudgetMonth, useBudgetStore } from "../store";
import { BudgetCard } from "./BudgetCard";
import { BudgetSummaryCard } from "./BudgetSummaryCard";

function AddBudgetButton({ onPress }: { readonly onPress: () => void }) {
  const primaryColor = useThemeColor("primary");

  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Plus size={24} color={primaryColor} />
    </Pressable>
  );
}

const budgetKeyExtractor = (item: BudgetProgress) => item.budgetId;

export function BudgetListScreen() {
  const { t } = useTranslation();
  const { push } = useRouter();

  const currentMonth = useBudgetStore((s) => s.currentMonth);
  const budgets = useBudgetStore((s) => s.budgets);
  const budgetProgress = useBudgetStore((s) => s.budgetProgress);
  const summary = useBudgetStore((s) => s.summary);
  const pendingPermissionRequest = useBudgetStore((s) => s.pendingPermissionRequest);
  const clearPendingPermissionRequest = useBudgetStore((s) => s.clearPendingPermissionRequest);
  const userId = useOptionalUserId();

  // Navigate to pre-permission screen when store signals it.
  // Uses useSubscription because the store's refreshProgress() is async/deep in the derivation
  // chain and cannot call router.push() directly — this is a Zustand subscription pattern.
  useSubscription(
    () => {
      let cancelled = false;

      void shouldShowNotificationPrePermissionPrompt()
        .then((shouldShowPrompt) => {
          if (cancelled || !shouldShowPrompt) return;

          push("/enable-notifications");
        })
        .catch(captureError)
        .finally(() => {
          if (!cancelled) clearPendingPermissionRequest();
        });

      return () => {
        cancelled = true;
      };
    },
    [pendingPermissionRequest, clearPendingPermissionRequest, push],
    pendingPermissionRequest
  );

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const monthAsDate = new Date(
    Number.parseInt(currentMonth.slice(0, 4), 10),
    Number.parseInt(currentMonth.slice(5, 7), 10) - 1,
    1
  );

  const handleAddBudget = useCallback(() => {
    push("/create-budget");
  }, [push]);

  const handleNextMonth = useCallback(() => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void nextBudgetMonth(db, userId);
  }, [userId]);

  const handlePrevMonth = useCallback(() => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void prevBudgetMonth(db, userId);
  }, [userId]);

  const handleAutoSetup = useCallback(() => {
    push("/auto-suggest-budgets");
  }, [push]);

  const handleCreateManually = useCallback(() => {
    push("/create-budget");
  }, [push]);

  const handleBudgetPress = useCallback(
    (budgetId: string) => {
      push({ pathname: "/create-budget", params: { budgetId } });
    },
    [push]
  );

  const hasBudgets = budgets.length > 0;
  const renderBudget = useCallback(
    ({ item }: ListRenderItemInfo<BudgetProgress>) => (
      <BudgetCard progress={item} onPress={handleBudgetPress} />
    ),
    [handleBudgetPress]
  );
  const budgetSummary = useMemo(
    () =>
      hasBudgets ? (
        <BudgetSummaryCard
          totalBudget={summary.totalBudget}
          totalSpent={summary.totalSpent}
          percentUsed={summary.percentUsed}
        />
      ) : null,
    [hasBudgets, summary.percentUsed, summary.totalBudget, summary.totalSpent]
  );
  const emptyState = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Wallet size={48} color={secondaryColor} />
        <Text style={[styles.emptyTitle, { color: primaryColor }]}>{t("budgets.empty.title")}</Text>
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
    ),
    [accentGreen, handleAutoSetup, handleCreateManually, primaryColor, secondaryColor, t]
  );

  return (
    <ScreenLayout
      title={t("budgets.title")}
      includesNativeHeader={false}
      rightActions={
        Platform.OS !== "ios" ? <AddBudgetButton onPress={handleAddBudget} /> : undefined
      }
    >
      <View style={styles.content}>
        <MonthNavigator
          currentMonth={monthAsDate}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
        />

        <FlashList
          data={hasBudgets ? budgetProgress : []}
          renderItem={renderBudget}
          keyExtractor={budgetKeyExtractor}
          ListHeaderComponent={budgetSummary}
          ListEmptyComponent={emptyState}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_CLEARANCE }]}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={BudgetItemSeparator}
        />
      </View>
    </ScreenLayout>
  );
}

const BudgetItemSeparator = () => <View style={styles.itemSeparator} />;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 12,
  },
  itemSeparator: {
    height: 12,
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
