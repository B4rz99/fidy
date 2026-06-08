import type { ListRenderItemInfo } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { formatMonthYear } from "@/features/calendar/public";
import { shouldShowNotificationPrePermissionPrompt } from "@/features/notifications/public";
import { Button, EmptyState, FeedList, ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Plus, Wallet } from "@/shared/components/icons";
import { Pressable, StyleSheet, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useSubscription, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { captureError } from "@/shared/lib";
import type { BudgetProgress } from "../lib/derive";
import {
  loadBudgetAutoSuggestions,
  nextBudgetMonth,
  prevBudgetMonth,
  useBudgetStore,
} from "../store";
import { BudgetAlertBanner } from "./BudgetAlertBanner";
import { BudgetCard } from "./BudgetCard";
import { BudgetHeaderMonthNavigator } from "./BudgetHeaderMonthNavigator";
import { BudgetSummaryCard } from "./BudgetSummaryCard";

function AddBudgetButton({
  accessibilityHint,
  accessibilityLabel,
  onPress,
}: {
  readonly accessibilityHint: string;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}) {
  const primaryColor = useThemeColor("primary");

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={12}
    >
      <Plus size={24} color={primaryColor} />
    </Pressable>
  );
}

const budgetKeyExtractor = (item: BudgetProgress) => item.budgetId;

export function BudgetListScreen() {
  const { t, locale } = useTranslation();
  const { push } = useRouter();

  const currentMonth = useBudgetStore((s) => s.currentMonth);
  const budgets = useBudgetStore((s) => s.budgets);
  const budgetProgress = useBudgetStore((s) => s.budgetProgress);
  const summary = useBudgetStore((s) => s.summary);
  const pendingAlerts = useBudgetStore((s) => s.pendingAlerts);
  const acknowledgeAlert = useBudgetStore((s) => s.acknowledgeAlert);
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

  const secondaryColor = useThemeColor("secondary");

  const monthAsDate = new Date(
    Number.parseInt(currentMonth.slice(0, 4), 10),
    Number.parseInt(currentMonth.slice(5, 7), 10) - 1,
    1
  );
  const monthLabel = formatMonthYear(monthAsDate, getDateFnsLocale(locale));

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
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    loadBudgetAutoSuggestions(db, userId);
    push("/auto-suggest-budgets");
  }, [push, userId]);

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
        <View style={styles.headerContent}>
          {pendingAlerts.map((alert) => (
            <BudgetAlertBanner
              key={`${alert.budgetId}:${alert.threshold}`}
              alert={alert}
              onDismiss={acknowledgeAlert}
            />
          ))}
          <BudgetSummaryCard
            totalBudget={summary.totalBudget}
            totalSpent={summary.totalSpent}
            percentUsed={summary.percentUsed}
          />
        </View>
      ) : null,
    [
      acknowledgeAlert,
      hasBudgets,
      pendingAlerts,
      summary.percentUsed,
      summary.totalBudget,
      summary.totalSpent,
    ]
  );
  const emptyState = useMemo(
    () => (
      <EmptyState
        title={t("budgets.empty.title")}
        subtitle={t("budgets.empty.subtitle")}
        icon={<Wallet size={48} color={secondaryColor} />}
        className="pt-20"
        action={
          <View className="mt-4 items-center" style={{ gap: 12 }}>
            <Button
              label={t("budgets.empty.autoSetup")}
              onPress={handleAutoSetup}
              className="px-8"
            />
            <Button
              label={t("budgets.empty.createManually")}
              variant="ghost"
              size="compact"
              onPress={handleCreateManually}
            />
          </View>
        }
      />
    ),
    [handleAutoSetup, handleCreateManually, secondaryColor, t]
  );

  return (
    <ScreenLayout
      title=""
      includesNativeHeader={false}
      centerAction={
        <BudgetHeaderMonthNavigator
          monthLabel={monthLabel}
          prevMonthLabel={t("budgets.header.previousMonthLabel")}
          prevMonthHint={t("budgets.header.previousMonthHint")}
          nextMonthLabel={t("budgets.header.nextMonthLabel")}
          nextMonthHint={t("budgets.header.nextMonthHint")}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
        />
      }
      rightActions={
        <AddBudgetButton
          accessibilityLabel={t("budgets.header.addLabel")}
          accessibilityHint={t("budgets.header.addHint")}
          onPress={handleAddBudget}
        />
      }
    >
      <FeedList
        data={hasBudgets ? budgetProgress : []}
        renderItem={renderBudget}
        keyExtractor={budgetKeyExtractor}
        header={budgetSummary}
        empty={emptyState}
        containerStyle={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_CLEARANCE }]}
        itemSeparatorHeight={8}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 8,
  },
  headerContent: {
    gap: 8,
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
