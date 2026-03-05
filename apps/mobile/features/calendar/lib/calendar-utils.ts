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
  return bills.filter((bill) => {
    if (!bill.isActive) return false;
    if (date < bill.startDate) return false;

    switch (bill.frequency) {
      case "monthly":
        return bill.startDate.getDate() === date.getDate();
      case "weekly":
        return getDay(bill.startDate) === getDay(date);
      case "biweekly": {
        const weeksDiff = differenceInWeeks(date, bill.startDate);
        return weeksDiff >= 0 && weeksDiff % 2 === 0 && getDay(bill.startDate) === getDay(date);
      }
      case "yearly":
        return (
          bill.startDate.getMonth() === date.getMonth() &&
          bill.startDate.getDate() === date.getDate()
        );
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
      const candidate = new Date(from.getFullYear(), from.getMonth(), day);
      return candidate >= from ? candidate : new Date(from.getFullYear(), from.getMonth() + 1, day);
    }
    case "yearly": {
      const candidate = new Date(from.getFullYear(), start.getMonth(), start.getDate());
      return candidate >= from
        ? candidate
        : new Date(from.getFullYear() + 1, start.getMonth(), start.getDate());
    }
  }
}
