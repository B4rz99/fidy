import * as Notifications from "expo-notifications";
import { deletePushToken, PROJECT_ID } from "./services/push-token";

export type { AlertAction } from "./lib/permission";
export { determineAlertAction, PRE_PERMISSION_KEY } from "./lib/permission";
export type {
  NotificationDisplay,
  NotificationSection as NotificationSectionType,
  NotificationType,
  StoredNotification,
} from "./lib/types";
export { scheduleLocalPush } from "./services/local-push";
export {
  readHasSeenPrePermission,
  shouldShowNotificationPrePermissionPrompt,
} from "./services/pre-permission";

export { deletePushToken, PROJECT_ID, registerPushToken } from "./services/push-token";
export {
  clearAllNotifications,
  initializeNotificationStore,
  insertNotificationRecord,
  loadNotificationsForUser,
  markNotificationsVisited,
  useNotificationStore,
} from "./store";

export async function cleanupCurrentPushToken(): Promise<void> {
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
  await deletePushToken(token);
}
