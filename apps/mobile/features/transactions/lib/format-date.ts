import { format, isToday } from "date-fns";

/**
 * Returns a human-readable date label.
 * Today → "Today, Mar 1, 2026"
 * Other → "Mar 1, 2026"
 */
export function getDateLabel(date: Date): string {
  const formatted = format(date, "MMM d, yyyy");
  return isToday(date) ? `Today, ${formatted}` : formatted;
}
