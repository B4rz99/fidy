import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import i18n from "@/shared/i18n/i18n";
import type { UserId } from "@/shared/types/branded";

const WEEKLY_DIGEST_TRIGGER = {
  type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
  weekday: 1,
  hour: 19,
  minute: 0,
} as const;

const scheduledDigestKey = (userId: UserId) => `weekly_digest_notification_${userId}`;

export async function cancelWeeklyDigestNotification(userId: UserId): Promise<void> {
  const previousId = await SecureStore.getItemAsync(scheduledDigestKey(userId));
  if (!previousId) return;

  await Notifications.cancelScheduledNotificationAsync(previousId);
  await SecureStore.deleteItemAsync(scheduledDigestKey(userId));
}

export async function scheduleWeeklyDigestReminder(userId: UserId): Promise<string | null> {
  try {
    await cancelWeeklyDigestNotification(userId);

    const scheduledId = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notifications.weeklyDigest.reminderTitle"),
        body: i18n.t("notifications.weeklyDigest.reminderBody"),
        data: { route: "/notifications", type: "weekly_digest" },
      },
      trigger: WEEKLY_DIGEST_TRIGGER,
    });

    await SecureStore.setItemAsync(scheduledDigestKey(userId), scheduledId);
    return scheduledId;
  } catch {
    return null;
  }
}
