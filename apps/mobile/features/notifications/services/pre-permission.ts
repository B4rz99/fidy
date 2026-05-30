import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { determineAlertAction, PRE_PERMISSION_KEY } from "../lib/permission";

export async function readHasSeenPrePermission(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(PRE_PERMISSION_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export function markPrePermissionSeen(): void {
  SecureStore.setItem(PRE_PERMISSION_KEY, "true");
}

export async function markPrePermissionSeenAsync(): Promise<void> {
  await SecureStore.setItemAsync(PRE_PERMISSION_KEY, "true");
}

export async function shouldShowNotificationPrePermissionPrompt(
  notificationsEnabled = true
): Promise<boolean> {
  const [permission, hasSeenPrePermission] = await Promise.all([
    Notifications.getPermissionsAsync(),
    readHasSeenPrePermission(),
  ]);
  const action = determineAlertAction(
    permission.status,
    hasSeenPrePermission,
    notificationsEnabled
  );

  return action.type === "pre_permission";
}
