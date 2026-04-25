import { isNotificationPreferenceEnabled } from "@/features/settings/public";
import type { UserId } from "@/shared/types/branded";
import {
  cancelWeeklyDigestNotification,
  scheduleWeeklyDigestReminder,
} from "./weekly-digest-schedule";

export async function syncWeeklyDigestReminder(userId: UserId): Promise<string | null> {
  try {
    if (!isNotificationPreferenceEnabled("weeklyDigest")) {
      await cancelWeeklyDigestNotification(userId);
      return null;
    }

    return await scheduleWeeklyDigestReminder(userId);
  } catch {
    return null;
  }
}
