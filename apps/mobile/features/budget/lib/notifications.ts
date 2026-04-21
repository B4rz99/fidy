import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { determineAlertAction, PRE_PERMISSION_KEY } from "@/features/notifications";
import i18n from "../../../shared/i18n/i18n";
import type { BudgetAlert } from "./derive";

export type ScheduleResult =
  | { readonly type: "scheduled"; readonly id: string }
  | { readonly type: "needs_permission" }
  | { readonly type: "skipped" };

type NonScheduledResult = Exclude<
  ScheduleResult,
  { readonly type: "scheduled"; readonly id: string }
>;

const RESULT_BY_ACTION = {
  prePermission: { type: "needs_permission" },
  skip: { type: "skipped" },
} as const satisfies Record<"prePermission" | "skip", NonScheduledResult>;

async function readHasSeenPrePermission(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(PRE_PERMISSION_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

function buildBudgetAlertCopy(alert: BudgetAlert, categoryName: string) {
  if (alert.threshold === 100) {
    return {
      title: i18n.t("budgets.alerts.overBudgetTitle"),
      body: i18n.t("budgets.alerts.overBudget", {
        category: categoryName,
        percent: alert.percentUsed,
      }),
    };
  }

  return {
    title: i18n.t("budgets.alerts.nearLimitTitle"),
    body: i18n.t("budgets.alerts.nearLimit", {
      category: categoryName,
      percent: alert.percentUsed,
    }),
  };
}

function getImmediateScheduleResult(
  actionType: ReturnType<typeof determineAlertAction>["type"]
): NonScheduledResult | null {
  if (actionType === "send") {
    return null;
  }

  return actionType === "pre_permission" ? RESULT_BY_ACTION.prePermission : RESULT_BY_ACTION.skip;
}

async function getBudgetAlertAction(notificationsEnabled: boolean) {
  const { status } = await Notifications.getPermissionsAsync();
  const hasSeenPrePermission = await readHasSeenPrePermission();
  return determineAlertAction(status, hasSeenPrePermission, notificationsEnabled);
}

async function scheduleBudgetNotification(
  alert: BudgetAlert,
  copy: ReturnType<typeof buildBudgetAlertCopy>
) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      data: {
        budgetId: alert.budgetId,
        categoryId: alert.categoryId,
        threshold: alert.threshold,
        route: "/(tabs)/(finance)",
      },
    },
    trigger: null, // immediate
  });
}

export async function scheduleBudgetAlert(
  alert: BudgetAlert,
  categoryName: string,
  notificationsEnabled = true
): Promise<ScheduleResult> {
  try {
    const action = await getBudgetAlertAction(notificationsEnabled);
    const immediateResult = getImmediateScheduleResult(action.type);

    if (immediateResult != null) {
      return immediateResult;
    }

    const id = await scheduleBudgetNotification(alert, buildBudgetAlertCopy(alert, categoryName));

    return { type: "scheduled", id };
  } catch {
    return { type: "skipped" };
  }
}
