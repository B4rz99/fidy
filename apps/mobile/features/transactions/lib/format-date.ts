import type { Locale } from "date-fns";
import { format, isSameDay } from "date-fns";

/**
 * Returns a human-readable date label using locale-aware formatting.
 * Today → "Hoy, 1 mar 2026" (es) or "Today, Mar 1, 2026" (en)
 * Other → "1 mar 2026" (es) or "Mar 1, 2026" (en)
 */
export function getDateLabel(
  date: Date,
  now: Date,
  todayLabel: string,
  dateFnsLocale?: Locale
): string {
  const formatted = format(date, "PP", dateFnsLocale ? { locale: dateFnsLocale } : undefined);
  return isSameDay(date, now) ? `${todayLabel}, ${formatted}` : formatted;
}
