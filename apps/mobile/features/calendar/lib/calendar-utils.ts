import {
  addDays,
  addWeeks,
  differenceInWeeks,
  format,
  getDay,
  getDaysInMonth,
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

  const grid: CalendarDay[][] = [];

  for (let week = 0; week < numWeeks; week++) {
    const row: CalendarDay[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const cellIndex = week * 7 + dayOfWeek;
      const dayNum = cellIndex - startOffset + 1;

      if (dayNum < 1 || dayNum > daysInMonth) {
        row.push({ day: null, date: null });
      } else {
        row.push({ day: dayNum, date: new Date(year, month, dayNum) });
      }
    }
    grid.push(row);
  }

  return grid;
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

export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy");
}

/**
 * Get the next occurrence of a bill from a given date.
 */
export function getNextOccurrence(bill: Bill, from: Date): Date {
  const start = bill.startDate;
  switch (bill.frequency) {
    case "weekly": {
      const dayDiff = (getDay(start) - getDay(from) + 7) % 7;
      const next = addDays(from, dayDiff === 0 ? 0 : dayDiff);
      return next >= from ? next : addWeeks(next, 1);
    }
    case "biweekly": {
      let next = start;
      while (next < from) next = addWeeks(next, 2);
      return next;
    }
    case "monthly": {
      const day = start.getDate();
      const y = from.getFullYear();
      const m = from.getMonth();
      const candidate = new Date(y, m, clampDay(day, y, m));
      if (candidate >= from) return candidate;
      return new Date(y, m + 1, clampDay(day, y, m + 1));
    }
    case "yearly": {
      const day = start.getDate();
      const sm = start.getMonth();
      const y = from.getFullYear();
      const candidate = new Date(y, sm, clampDay(day, y, sm));
      if (candidate >= from) return candidate;
      return new Date(y + 1, sm, clampDay(day, y + 1, sm));
    }
  }
}
