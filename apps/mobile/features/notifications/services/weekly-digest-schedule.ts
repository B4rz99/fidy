import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import type { UserId } from "@/shared/types/branded";

const WEEKLY_DIGEST_NOTIFICATION_TYPE = "weekly_digest";
const WEEKLY_DIGEST_NOTIFICATION_KEY = "weekly_digest_notification";
const WEEKLY_DIGEST_LEGACY_CLEANUP_KEY = "weekly_digest_notification_legacy_cleanup_v1";

type ScheduledNotificationRequest = {
  readonly identifier: string;
  readonly content: {
    readonly data?: Record<string, unknown> | null;
  };
};

const legacyScheduledDigestKey = (userId: UserId) => `${WEEKLY_DIGEST_NOTIFICATION_KEY}_${userId}`;

async function getScheduledWeeklyDigestIds(): Promise<readonly string[]> {
  try {
    const scheduledNotifications =
      (await Notifications.getAllScheduledNotificationsAsync()) as readonly ScheduledNotificationRequest[];

    return scheduledNotifications.flatMap((notification) =>
      notification.content.data?.type === WEEKLY_DIGEST_NOTIFICATION_TYPE
        ? [notification.identifier]
        : []
    );
  } catch {
    return [];
  }
}

const compactUniqueIds = (ids: readonly (string | null)[]): readonly string[] =>
  Array.from(new Set(ids.filter((id): id is string => id !== null && id.length > 0)));

export async function cancelWeeklyDigestNotification(userId: UserId): Promise<void> {
  const [storedId, legacyStoredId, scheduledIds] = await Promise.all([
    SecureStore.getItemAsync(WEEKLY_DIGEST_NOTIFICATION_KEY),
    SecureStore.getItemAsync(legacyScheduledDigestKey(userId)),
    getScheduledWeeklyDigestIds(),
  ]);
  const idsToCancel = compactUniqueIds([storedId, legacyStoredId, ...scheduledIds]);

  await Promise.all(idsToCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  try {
    await SecureStore.deleteItemAsync(WEEKLY_DIGEST_NOTIFICATION_KEY);
    await SecureStore.deleteItemAsync(legacyScheduledDigestKey(userId));
  } catch {}
}

export async function cleanupLegacyWeeklyDigestNotificationSchedules(
  userId: UserId
): Promise<void> {
  const hasCleanedUp = await SecureStore.getItemAsync(WEEKLY_DIGEST_LEGACY_CLEANUP_KEY);
  if (hasCleanedUp === "true") return;

  await cancelWeeklyDigestNotification(userId);
  await SecureStore.setItemAsync(WEEKLY_DIGEST_LEGACY_CLEANUP_KEY, "true");
}
