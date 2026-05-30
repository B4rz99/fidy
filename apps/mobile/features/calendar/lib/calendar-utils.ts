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
import type { BillPayment } from "../schema";

/** Clamp a day-of-month to the max days in the target month. */
function clampDay(day: number, year: number, month: number): number {
  return Math.min(day, getDaysInMonth(new Date(year, month)));
}

export type CalendarDay = {
  day: number | null;
  date: Date | null;
};

export type CalendarBillOccurrence = {
  readonly bill: Bill;
  readonly date: Date;
  readonly dueDate: string;
  readonly isPaid: boolean;
};

export type CalendarMonthSummary = {
  readonly monthOccurrences: readonly CalendarBillOccurrence[];
  readonly totalAmount: number;
  readonly paidAmount: number;
  readonly pendingAmount: number;
  readonly pendingCount: number;
  readonly upcomingPending: readonly CalendarBillOccurrence[];
};

type CalendarMonthSummaryInput = {
  readonly bills: readonly Bill[];
  readonly currentMonth: Date;
  readonly payments: readonly BillPayment[];
};

type CalendarDateContext = {
  readonly date: Date;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly dayOfWeek: number;
};

type OccurrenceContext = {
  readonly start: Date;
  readonly normalizedFrom: Date;
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
export function getBillsForDate(bills: readonly Bill[], date: Date): Bill[] {
  const calendarDate = getCalendarDateContext(date);
  return bills.filter((bill) => billOccursOnDate(bill, calendarDate));
}

export function buildCalendarMonthSummary({
  bills,
  currentMonth,
  payments,
}: CalendarMonthSummaryInput): CalendarMonthSummary {
  const occurrences = getMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth()).flatMap(
    (week) =>
      week.flatMap((cell) => {
        const date = cell.date;
        return date == null || cell.day == null
          ? []
          : getBillsForDate(bills, date).map((bill) => {
              const dueDate = toCalendarIsoDate(date);
              return {
                bill,
                date,
                dueDate,
                isPaid: payments.some(
                  (payment) => payment.billId === bill.id && payment.dueDate === dueDate
                ),
              };
            });
      })
  );

  const paidAmount = occurrences
    .filter((occurrence) => occurrence.isPaid)
    .reduce((total, occurrence) => total + occurrence.bill.amount, 0);
  const pendingOccurrences = occurrences.filter((occurrence) => !occurrence.isPaid);
  const pendingAmount = pendingOccurrences.reduce(
    (total, occurrence) => total + occurrence.bill.amount,
    0
  );

  return {
    monthOccurrences: occurrences,
    totalAmount: paidAmount + pendingAmount,
    paidAmount,
    pendingAmount,
    pendingCount: pendingOccurrences.length,
    upcomingPending: pendingOccurrences.slice(0, 3),
  };
}

export function formatMonthYear(date: Date, dateFnsLocale?: Locale): string {
  return format(date, "MMMM yyyy", dateFnsLocale ? { locale: dateFnsLocale } : undefined);
}

function toCalendarIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Get the next occurrence of a bill from a given date.
 */
export function getNextOccurrence(bill: Bill, from: Date): Date {
  return getNextOccurrenceForFrequency(bill.frequency, {
    start: bill.startDate,
    normalizedFrom: startOfDay(from),
  });
}

function getCalendarDateContext(date: Date): CalendarDateContext {
  return {
    date,
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    dayOfWeek: getDay(date),
  };
}

function billOccursOnDate(bill: Bill, calendarDate: CalendarDateContext): boolean {
  if (!bill.isActive) return false;
  if (calendarDate.date < bill.startDate) return false;
  const matcher = BILL_DATE_MATCHERS[bill.frequency as Bill["frequency"]];
  return matcher ? matcher(bill, calendarDate) : false;
}

const BILL_DATE_MATCHERS = {
  monthly: (bill: Bill, calendarDate: CalendarDateContext): boolean =>
    clampDay(bill.startDate.getDate(), calendarDate.year, calendarDate.month) === calendarDate.day,
  weekly: (bill: Bill, calendarDate: CalendarDateContext): boolean =>
    getDay(bill.startDate) === calendarDate.dayOfWeek,
  biweekly: (bill: Bill, calendarDate: CalendarDateContext): boolean => {
    const weeksDiff = differenceInWeeks(calendarDate.date, bill.startDate);
    return (
      weeksDiff >= 0 && weeksDiff % 2 === 0 && getDay(bill.startDate) === calendarDate.dayOfWeek
    );
  },
  yearly: (bill: Bill, calendarDate: CalendarDateContext): boolean =>
    bill.startDate.getMonth() === calendarDate.month &&
    clampDay(bill.startDate.getDate(), calendarDate.year, calendarDate.month) === calendarDate.day,
} satisfies Record<Bill["frequency"], (bill: Bill, calendarDate: CalendarDateContext) => boolean>;

const NEXT_OCCURRENCE_HANDLERS = {
  weekly: ({ start, normalizedFrom }: OccurrenceContext): Date => {
    const dayDiff = (getDay(start) - getDay(normalizedFrom) + 7) % 7;
    const next = addDays(normalizedFrom, dayDiff === 0 ? 0 : dayDiff);
    return next >= normalizedFrom ? next : addWeeks(next, 1);
  },
  biweekly: ({ start, normalizedFrom }: OccurrenceContext): Date => {
    const daysDiff = differenceInCalendarDays(normalizedFrom, start);
    const periods = daysDiff <= 0 ? 0 : Math.ceil(daysDiff / 14);
    return addWeeks(start, periods * 2);
  },
  monthly: ({ start, normalizedFrom }: OccurrenceContext): Date => {
    const year = normalizedFrom.getFullYear();
    const month = normalizedFrom.getMonth();
    const candidate = new Date(year, month, clampDay(start.getDate(), year, month));
    return candidate >= normalizedFrom
      ? candidate
      : new Date(year, month + 1, clampDay(start.getDate(), year, month + 1));
  },
  yearly: ({ start, normalizedFrom }: OccurrenceContext): Date => {
    const year = normalizedFrom.getFullYear();
    const month = start.getMonth();
    const candidate = new Date(year, month, clampDay(start.getDate(), year, month));
    return candidate >= normalizedFrom
      ? candidate
      : new Date(year + 1, month, clampDay(start.getDate(), year + 1, month));
  },
} satisfies Record<Bill["frequency"], (context: OccurrenceContext) => Date>;

function getNextOccurrenceForFrequency(
  frequency: Bill["frequency"],
  context: OccurrenceContext
): Date {
  return NEXT_OCCURRENCE_HANDLERS[frequency](context);
}
