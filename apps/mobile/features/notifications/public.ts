import * as Notifications from "expo-notifications";
import { deletePushToken, PROJECT_ID } from "./services/push-token";

export async function cleanupCurrentPushToken(): Promise<void> {
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
  await deletePushToken(token);
}
