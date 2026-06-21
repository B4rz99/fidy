import type { Bill } from "../schema";

/**
 * Schedule bill notifications — no-op until expo-notifications is available.
 * Requires a paid Apple Developer account for push notification entitlements.
 */
export async function scheduleBillNotifications(_bill: Bill): Promise<string[]> {
  return [];
}

/**
 * Request notification permissions — no-op, returns false.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}
