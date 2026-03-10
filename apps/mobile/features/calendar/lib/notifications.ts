import { addDays, subDays } from "date-fns";
import * as Notifications from "expo-notifications";
import { centsToDisplay } from "@/features/transactions/lib/format-amount";
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

type ReminderSpec = {
  title: string;
  body: string;
  triggerDate: Date;
};

/**
 * Build reminder specs (7-day + 1-day) for a list of due dates.
 * Pure function — produces the notification payloads without scheduling.
 */
function buildReminderSpecs(bill: Bill, occurrences: Date[]): ReminderSpec[] {
  const now = new Date();
  const amount = centsToDisplay(bill.amountCents);

  return occurrences.flatMap((dueDate) => {
    const sevenDays: ReminderSpec = {
      title: `${bill.name} due in 7 days`,
      body: `${amount} payment coming up on ${dueDate.toLocaleDateString()}`,
      triggerDate: subDays(dueDate, 7),
    };
    const oneDay: ReminderSpec = {
      title: `${bill.name} due tomorrow`,
      body: `${amount} payment due on ${dueDate.toLocaleDateString()}`,
      triggerDate: subDays(dueDate, 1),
    };
    return [sevenDays, oneDay].filter((r) => r.triggerDate > now);
  });
}

/**
 * Schedule 7-day and 1-day reminder notifications for the next 3 occurrences of a bill.
 * Returns an array of scheduled notification identifiers.
 */
export async function scheduleBillNotifications(bill: Bill): Promise<string[]> {
  const occurrences = computeUpcomingOccurrences(bill, 3, new Date());
  const specs = buildReminderSpecs(bill, occurrences);

  const ids = await Promise.all(
    specs.map((spec) =>
      Notifications.scheduleNotificationAsync({
        content: { title: spec.title, body: spec.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: spec.triggerDate },
      })
    )
  );

  return ids;
}

/**
 * Cancel previously scheduled notifications by their identifiers.
 */
export async function cancelBillNotifications(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

/**
 * Request notification permissions. Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}
