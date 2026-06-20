import type { ListRenderItemInfo } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useOptionalUserId } from "@/features/auth/public";
import { formatMonthYear } from "@/features/calendar/public";
import { shouldShowNotificationPrePermissionPrompt } from "@/features/notifications/public";
import {
  Button,
  EmptyState,
  FeedList,
  AddActionButton,
  ScreenLayout,
  TAB_BAR_CLEARANCE,
} from "@/shared/components";
import { Wallet } from "@/shared/components/icons";
import { StyleSheet, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useSubscription, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { captureError } from "@/shared/lib";
import type { BudgetProgress } from "../lib/derive";
import { nextBudgetMonth, prevBudgetMonth, useBudgetStore } from "../store";
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
  return (
    <AddActionButton
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    />
  );
}

const budgetKeyExtractor = (item: BudgetProgress) => item.budgetId;
const BUDGET_SCREEN_SECTION_GAP = 16;

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

  const primaryColor = useThemeColor("primary");

  const monthAsDate = new Date(
    Number.parseInt(currentMonth.slice(0, 4), 10),
    Number.parseInt(currentMonth.slice(5, 7), 10) - 1,
    1
  );
  const monthLabel = formatMonthYear(monthAsDate, getDateFnsLocale(locale));

  const handleAddBudget = () => {
    push("/create-budget");
  };

  const handleNextMonth = () => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void nextBudgetMonth(db, userId);
  };

  const handlePrevMonth = () => {
    if (!userId) return;
    const db = tryGetDb(userId);
    if (!db) return;
    void prevBudgetMonth(db, userId);
  };

  const handleAutoSetup = () => {
    push("/auto-suggest-budgets");
  };

  const handleCreateManually = () => {
    push("/create-budget");
  };

  const handleBudgetPress = (budgetId: string) => {
    push({ pathname: "/create-budget", params: { budgetId } });
  };

  const hasBudgets = budgets.length > 0;
  const renderBudget = ({ item }: ListRenderItemInfo<BudgetProgress>) => (
    <BudgetCard progress={item} onPress={handleBudgetPress} />
  );
  const budgetSummary = hasBudgets ? (
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
  ) : null;
  const emptyState = (
    <EmptyState
      title={t("budgets.empty.title")}
      subtitle={t("budgets.empty.subtitle")}
      icon={<Wallet size={48} color={primaryColor} />}
      className="justify-start"
      style={styles.emptyState}
      action={
        <View style={styles.emptyActions}>
          <Button
            label={t("budgets.empty.autoSetup")}
            onPress={handleAutoSetup}
            className="w-full max-w-[360px]"
          />
          <Button
            label={t("budgets.empty.createManually")}
            variant="secondary"
            onPress={handleCreateManually}
            className="w-full max-w-[360px]"
          />
        </View>
      }
    />
  );

  return (
    <ScreenLayout
      title=""
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
        itemSeparatorHeight={BUDGET_SCREEN_SECTION_GAP}
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
    gap: BUDGET_SCREEN_SECTION_GAP,
    paddingTop: BUDGET_SCREEN_SECTION_GAP,
  },
  headerContent: {
    gap: BUDGET_SCREEN_SECTION_GAP,
  },
  emptyState: {
    flex: 0,
    gap: 10,
    minHeight: 430,
    paddingHorizontal: 20,
    paddingTop: 104,
  },
  emptyActions: {
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    width: "100%",
  },
});
