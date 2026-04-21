import type { Locale } from "date-fns";
import { format, isSameDay } from "date-fns";

type GetDateLabelInput = {
  readonly date: Date;
  readonly now: Date;
  readonly todayLabel: string;
  readonly dateFnsLocale?: Locale;
};

/**
 * Returns a human-readable date label using locale-aware formatting.
 * Today -> "Hoy, 1 mar 2026" (es) or "Today, Mar 1, 2026" (en)
 * Other -> "1 mar 2026" (es) or "Mar 1, 2026" (en)
 */
export function getDateLabel(input: GetDateLabelInput): string {
  const formatted = format(
    input.date,
    "PP",
    input.dateFnsLocale ? { locale: input.dateFnsLocale } : undefined
  );
  return isSameDay(input.date, input.now) ? `${input.todayLabel}, ${formatted}` : formatted;
}
