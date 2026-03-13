import { addDays } from "date-fns";
import type { Bill } from "../schema";
import { getNextOccurrence } from "./calendar-utils";

/**
 * Compute the next N upcoming occurrences of a bill from a reference date.
 * Pure function — no side effects.
 */
export function computeUpcomingOccurrences(bill: Bill, count: number, from: Date): Date[] {
  if (count <= 0) return [];

  return Array.from({ length: count }).reduce<Date[]>((acc) => {
    const searchFrom = acc.length === 0 ? from : addDays(acc[acc.length - 1], 1);
    return [...acc, getNextOccurrence(bill, searchFrom)];
  }, []);
}

/**
 * Schedule bill notifications — no-op until expo-notifications is available.
 * Requires a paid Apple Developer account for push notification entitlements.
 */
export async function scheduleBillNotifications(_bill: Bill): Promise<string[]> {
  return [];
}

/**
 * Cancel bill notifications — no-op.
 */
export async function cancelBillNotifications(_ids: string[]): Promise<void> {}

/**
 * Request notification permissions — no-op, returns false.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}
