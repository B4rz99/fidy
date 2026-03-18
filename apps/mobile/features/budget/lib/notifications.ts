import * as Notifications from "expo-notifications";
import i18n from "../../../shared/i18n/i18n";
import type { BudgetAlert } from "./derive";

let handlerConfigured = false;

function ensureHandlerConfigured() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestBudgetNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleBudgetAlert(
  alert: BudgetAlert,
  categoryName: string
): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return null;

    ensureHandlerConfigured();

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

    return id;
  } catch {
    return null;
  }
}
