import * as Notifications from "expo-notifications";
import type { NotificationPreferences } from "@/features/settings";
import { useSettingsStore } from "@/features/settings";

type LocalPushInput = {
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown>;
  readonly preferenceKey: keyof NotificationPreferences;
};

/**
 * Schedule an immediate local push notification with preference guards.
 * Returns the notification ID if scheduled, or null if the preference is off
 * or an error occurs. Best-effort — never throws.
 *
 * Note: This is a side-effectful service function that reads from the Zustand
 * settings store, so it lives in services/ rather than lib/.
 */
export async function scheduleLocalPush(input: LocalPushInput): Promise<string | null> {
  try {
    const { notificationPreferences } = useSettingsStore.getState();
    if (!notificationPreferences[input.preferenceKey]) {
      return null;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data,
      },
      trigger: null,
    });

    return id;
  } catch {
    return null;
  }
}
