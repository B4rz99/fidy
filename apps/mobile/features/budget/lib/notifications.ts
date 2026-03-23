import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { determineAlertAction, PRE_PERMISSION_KEY } from "@/features/notifications/lib/permission";
import i18n from "../../../shared/i18n/i18n";
import type { BudgetAlert } from "./derive";

export type ScheduleResult =
  | { readonly type: "scheduled"; readonly id: string }
  | { readonly type: "needs_permission" }
  | { readonly type: "skipped" };

async function readHasSeenPrePermission(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(PRE_PERMISSION_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function scheduleBudgetAlert(
  alert: BudgetAlert,
  categoryName: string,
  notificationsEnabled = true
): Promise<ScheduleResult> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    const hasSeenPrePermission = await readHasSeenPrePermission();
    const action = determineAlertAction(status, hasSeenPrePermission, notificationsEnabled);

    if (action.type === "pre_permission") return { type: "needs_permission" };
    if (action.type === "skip") return { type: "skipped" };

    // action.type === "send" — schedule the notification
    const title =
      alert.threshold === 100
        ? i18n.t("budgets.alerts.overBudgetTitle")
        : i18n.t("budgets.alerts.nearLimitTitle");
    const body =
      alert.threshold === 100
        ? i18n.t("budgets.alerts.overBudget", {
            category: categoryName,
            percent: alert.percentUsed,
          })
        : i18n.t("budgets.alerts.nearLimit", {
            category: categoryName,
            percent: alert.percentUsed,
          });

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          budgetId: alert.budgetId,
          categoryId: alert.categoryId,
          threshold: alert.threshold,
        },
      },
      trigger: null, // immediate
    });

    return { type: "scheduled", id };
  } catch {
    return { type: "skipped" };
  }
}
