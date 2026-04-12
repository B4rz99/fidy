import { format, subMonths } from "date-fns";
import type { AnyDb } from "@/shared/db";
import { formatMoney } from "@/shared/lib";
import type {
  BudgetId,
  CategoryId,
  CopAmount,
  Month,
  UserId,
} from "@/shared/types/branded";
import {
  computeDaysLeft,
  deriveAutoSuggestBudgets,
  deriveBudgetAlerts,
  deriveBudgetProgress,
  deriveBudgetSummary,
} from "./derive";
import type {
  BudgetAlert,
  BudgetProgress,
  BudgetSuggestion,
} from "./derive";
import type { Budget } from "../schema";
import { getBudgetsForMonth } from "./repository";
import { getSpendingByCategoryAggregate } from "@/features/transactions/lib/repository";

export type BudgetAlertState = {
  readonly pendingAlerts: readonly BudgetAlert[];
  readonly acknowledgedAlerts: ReadonlySet<string>;
};

export type BudgetMonthSnapshot = {
  readonly budgets: readonly Budget[];
  readonly budgetProgress: readonly BudgetProgress[];
  readonly summary: {
    readonly totalBudget: number;
    readonly totalSpent: number;
    readonly percentUsed: number;
  };
  readonly autoSuggestions: readonly BudgetSuggestion[];
  readonly pendingAlerts: readonly BudgetAlert[];
  readonly pendingPermissionRequest: boolean;
};

export type BudgetNotificationInput = {
  readonly type: "budget_alert";
  readonly dedupKey: string;
  readonly categoryId: CategoryId | null;
  readonly goalId: string | null;
  readonly titleKey: string;
  readonly messageKey: string;
  readonly params: string | null;
};

export type RefreshBudgetMonthInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly month: Month;
  readonly previous?: BudgetAlertState;
};

export type AcknowledgeBudgetAlertInput = {
  readonly budgetId: BudgetId;
  readonly threshold: 80 | 100;
  readonly alertState: BudgetAlertState;
};

export type BudgetMonitoringPorts = {
  readonly getBudgetAlertsEnabled: () => boolean;
  readonly getLocale: () => string;
  readonly resolveCategoryLabel: (categoryId: CategoryId, locale: string) => string;
  readonly scheduleBudgetAlert: (
    alert: BudgetAlert,
    categoryName: string,
    notificationsEnabled: boolean
  ) => Promise<import("./notifications").ScheduleResult>;
  readonly insertNotification: (input: BudgetNotificationInput) => void;
};

export type BudgetMonitoringModule = {
  readonly refreshMonth: (
    input: RefreshBudgetMonthInput
  ) => Promise<BudgetMonthSnapshot>;
  readonly acknowledgeAlert: (
    input: AcknowledgeBudgetAlertInput
  ) => BudgetAlertState;
};

const alertKey = (budgetId: BudgetId, threshold: 80 | 100): string =>
  `${budgetId}:${threshold}`;

const formatMonth = (date: Date): Month => format(date, "yyyy-MM") as Month;

const parseMonth = (month: Month): Date => {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthIndex = (parts[1] ?? 1) - 1;
  return new Date(year, monthIndex, 1);
};

const toNotificationInput = (
  alert: BudgetAlert,
  categoryName: string,
  month: Month
): BudgetNotificationInput => {
  const remaining = formatMoney(Math.abs(alert.remainingAmount) as CopAmount);

  return {
    type: "budget_alert",
    dedupKey: `budget_alert:${alert.categoryId}:${alert.threshold}:${month}`,
    categoryId: alert.categoryId,
    goalId: null,
    titleKey:
      alert.threshold === 80 ? "notifications.budgetWarning" : "notifications.budgetExceeded",
    messageKey:
      alert.threshold === 80
        ? "notifications.budgetWarningMsg"
        : "notifications.budgetExceededMsg",
    params: JSON.stringify({
      category: categoryName,
      remaining,
      daysLeft: alert.daysLeft,
      overAmount: remaining,
      threshold: alert.threshold,
    }),
  };
};

const deriveFreshAlerts = (
  pendingAlerts: readonly BudgetAlert[],
  previousPendingAlerts: readonly BudgetAlert[]
): readonly BudgetAlert[] => {
  const previousKeys = new Set(
    previousPendingAlerts.map((alert) => alertKey(alert.budgetId, alert.threshold))
  );
  return pendingAlerts.filter(
    (alert) => !previousKeys.has(alertKey(alert.budgetId, alert.threshold))
  );
};

const deliverFreshAlerts = async (
  labeledFreshAlerts: readonly {
    readonly alert: BudgetAlert;
    readonly categoryName: string;
  }[],
  notificationsEnabled: boolean,
  scheduleBudgetAlert: BudgetMonitoringPorts["scheduleBudgetAlert"]
): Promise<boolean> => {
  const firstAlert = labeledFreshAlerts[0];
  if (firstAlert == null) return false;

  const firstResult = await scheduleBudgetAlert(
    firstAlert.alert,
    firstAlert.categoryName,
    notificationsEnabled
  );
  if (firstResult.type === "needs_permission") return true;
  if (firstResult.type !== "scheduled") return false;

  await Promise.all(
    labeledFreshAlerts.slice(1).map(async ({ alert, categoryName }) => {
      try {
        await scheduleBudgetAlert(alert, categoryName, notificationsEnabled);
      } catch {
        // Best effort: later alerts should not block refresh.
      }
    })
  );

  return false;
};

const insertFreshAlertNotifications = (
  labeledFreshAlerts: readonly {
    readonly alert: BudgetAlert;
    readonly categoryName: string;
  }[],
  month: Month,
  insertNotification: BudgetMonitoringPorts["insertNotification"]
): void => {
  labeledFreshAlerts.forEach(({ alert, categoryName }) => {
    insertNotification(toNotificationInput(alert, categoryName, month));
  });
};

export function createBudgetMonitoringModule(
  ports: BudgetMonitoringPorts
): BudgetMonitoringModule {
  return {
    refreshMonth: async ({ db, userId, month, previous }) => {
      const budgets = getBudgetsForMonth(db, userId, month);
      const currentSpending = getSpendingByCategoryAggregate(db, userId, month);
      const spendingMap = new Map(currentSpending.map((row) => [row.categoryId, row.total]));
      const budgetProgress = budgets.map((budget) =>
        deriveBudgetProgress(budget, spendingMap.get(budget.categoryId) ?? (0 as CopAmount))
      );
      const summary = deriveBudgetSummary(budgetProgress);
      const daysLeft = computeDaysLeft(month, new Date());
      const pendingAlerts = deriveBudgetAlerts(
        budgetProgress,
        previous?.acknowledgedAlerts ?? new Set<string>(),
        daysLeft
      );
      const previousPendingAlerts = previous?.pendingAlerts ?? [];
      const freshAlerts = deriveFreshAlerts(pendingAlerts, previousPendingAlerts);
      const locale = ports.getLocale();
      const labeledFreshAlerts = freshAlerts.map((alert) => ({
        alert,
        categoryName: ports.resolveCategoryLabel(alert.categoryId, locale),
      }));
      const notificationsEnabled = ports.getBudgetAlertsEnabled();
      const pendingPermissionRequest = await deliverFreshAlerts(
        labeledFreshAlerts,
        notificationsEnabled,
        ports.scheduleBudgetAlert
      );
      insertFreshAlertNotifications(labeledFreshAlerts, month, ports.insertNotification);

      const previousMonth = formatMonth(subMonths(parseMonth(month), 1));
      const previousSpending = getSpendingByCategoryAggregate(db, userId, previousMonth);
      const autoSuggestions = deriveAutoSuggestBudgets(
        previousSpending,
        new Set(budgets.map((budget) => budget.categoryId))
      );

      return {
        budgets,
        budgetProgress,
        summary,
        autoSuggestions,
        pendingAlerts,
        pendingPermissionRequest,
      };
    },

    acknowledgeAlert: ({ budgetId, threshold, alertState }) => {
      const key = alertKey(budgetId, threshold);
      return {
        acknowledgedAlerts: new Set([...alertState.acknowledgedAlerts, key]),
        pendingAlerts: alertState.pendingAlerts.filter(
          (alert) => alertKey(alert.budgetId, alert.threshold) !== key
        ),
      };
    },
  };
}
