import type { Locale } from "date-fns";
import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  differenceInWeeks,
  format,
  getDay,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { Bill } from "../schema";

/** Clamp a day-of-month to the max days in the target month. */
function clampDay(day: number, year: number, month: number): number {
  return Math.min(day, getDaysInMonth(new Date(year, month)));
}

export type CalendarDay = {
  day: number | null;
  date: Date | null;
};

export const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/**
 * Returns a 2D array (weeks x 7) for a given month.
 * Week starts on Monday (0 = Mon, 6 = Sun).
 */
export function getMonthGrid(year: number, month: number): CalendarDay[][] {
  const firstDay = startOfMonth(new Date(year, month));
  const daysInMonth = getDaysInMonth(firstDay);

  // getDay: 0=Sun, 1=Mon ... 6=Sat → convert to Mon-start: Mon=0, Sun=6
  const rawStartDay = getDay(firstDay);
  const startOffset = rawStartDay === 0 ? 6 : rawStartDay - 1;

  const totalCells = startOffset + daysInMonth;
  const numWeeks = Math.ceil(totalCells / 7);

  return Array.from({ length: numWeeks }, (_, week) =>
    Array.from({ length: 7 }, (_, dayOfWeek) => {
      const cellIndex = week * 7 + dayOfWeek;
      const dayNum = cellIndex - startOffset + 1;
      return dayNum < 1 || dayNum > daysInMonth
        ? { day: null, date: null }
        : { day: dayNum, date: new Date(year, month, dayNum) };
    })
  );
}

/**
 * Returns bills that occur on a specific date based on their frequency.
 */
export function getBillsForDate(bills: Bill[], date: Date): Bill[] {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  return bills.filter((bill) => {
    if (!bill.isActive) return false;
    if (date < bill.startDate) return false;

    switch (bill.frequency) {
      case "monthly":
        return clampDay(bill.startDate.getDate(), y, m) === d;
      case "weekly":
        return getDay(bill.startDate) === getDay(date);
      case "biweekly": {
        const weeksDiff = differenceInWeeks(date, bill.startDate);
        return weeksDiff >= 0 && weeksDiff % 2 === 0 && getDay(bill.startDate) === getDay(date);
      }
      case "yearly": {
        if (bill.startDate.getMonth() !== m) return false;
        return clampDay(bill.startDate.getDate(), y, m) === d;
      }
      default:
        return false;
    }
  });
}

export function formatMonthYear(date: Date, dateFnsLocale?: Locale): string {
  return format(date, "MMMM yyyy", dateFnsLocale ? { locale: dateFnsLocale } : undefined);
}

/**
 * Get the next occurrence of a bill from a given date.
 */
export function getNextOccurrence(bill: Bill, from: Date): Date {
  const start = bill.startDate;
  // Normalize to midnight so a bill due today isn't skipped
  const normalizedFrom = startOfDay(from);
  switch (bill.frequency) {
    case "weekly": {
      const dayDiff = (getDay(start) - getDay(normalizedFrom) + 7) % 7;
      const next = addDays(normalizedFrom, dayDiff === 0 ? 0 : dayDiff);
      return next >= normalizedFrom ? next : addWeeks(next, 1);
    }
    case "biweekly": {
      const daysDiff = differenceInCalendarDays(normalizedFrom, start);
      const periods = daysDiff <= 0 ? 0 : Math.ceil(daysDiff / 14);
      return addWeeks(start, periods * 2);
    }
    case "monthly": {
      const day = start.getDate();
      const y = normalizedFrom.getFullYear();
      const m = normalizedFrom.getMonth();
      const candidate = new Date(y, m, clampDay(day, y, m));
      if (candidate >= normalizedFrom) return candidate;
      return new Date(y, m + 1, clampDay(day, y, m + 1));
    }
    case "yearly": {
      const day = start.getDate();
      const sm = start.getMonth();
      const y = normalizedFrom.getFullYear();
      const candidate = new Date(y, sm, clampDay(day, y, sm));
      if (candidate >= normalizedFrom) return candidate;
      return new Date(y + 1, sm, clampDay(day, y + 1, sm));
    }
  }
}
