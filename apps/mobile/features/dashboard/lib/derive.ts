import { toIsoDate } from "@/shared/lib/format-date";
import type { CategoryId, CopAmount, IsoDate } from "@/shared/types/branded";

export type DashboardPeriod = "today" | "week" | "month";

type DateRange = {
  readonly start: IsoDate;
  readonly end: IsoDate;
};

export type DashboardRange = {
  readonly spending: DateRange;
  readonly lineChart: DateRange;
};

export type CategoryPercent = {
  readonly categoryId: CategoryId;
  readonly total: CopAmount;
  readonly percent: number;
};

/** Returns a Date offset by `days` relative to `base` (negative = in the past). */
const offsetDate = (base: Date, days: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);

/** Returns the last day of the month for a given date. */
const lastDayOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 0);

/** Returns the first day of the month for a given date. */
const firstDayOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

/**
 * Pure derivation: compute spending and lineChart date ranges for a given
 * DashboardPeriod relative to today.
 *
 * Spending ranges:
 * - today:  today–today
 * - week:   today-6d–today
 * - month:  1st–last of current calendar month
 *
 * LineChart ranges:
 * - today:  today-6d–today (7-day context)
 * - week:   today-6d–today
 * - month:  today-29d–today
 */
export function computeDashboardRange(period: DashboardPeriod, today: Date): DashboardRange {
  const todayIso = toIsoDate(today);
  const sixDaysAgo = toIsoDate(offsetDate(today, -6));
  const twentyNineDaysAgo = toIsoDate(offsetDate(today, -29));

  const spendingRange: Record<DashboardPeriod, DateRange> = {
    today: { start: todayIso, end: todayIso },
    week: { start: sixDaysAgo, end: todayIso },
    month: {
      start: toIsoDate(firstDayOfMonth(today)),
      end: toIsoDate(lastDayOfMonth(today)),
    },
  };

  const lineChartRange: Record<DashboardPeriod, DateRange> = {
    today: { start: sixDaysAgo, end: todayIso },
    week: { start: sixDaysAgo, end: todayIso },
    month: { start: twentyNineDaysAgo, end: todayIso },
  };

  return {
    spending: spendingRange[period],
    lineChart: lineChartRange[period],
  };
}

/**
 * Pure derivation: add a `percent` field to each category based on its share
 * of totalSpent. Rounds to nearest integer. Returns 0% for all when totalSpent is 0.
 */
export function deriveCategoryPercents(
  categories: ReadonlyArray<{ readonly categoryId: CategoryId; readonly total: CopAmount }>,
  totalSpent: CopAmount
): ReadonlyArray<CategoryPercent> {
  return categories.map((item) => ({
    categoryId: item.categoryId,
    total: item.total,
    percent: totalSpent === 0 ? 0 : Math.round((item.total / totalSpent) * 100),
  }));
}
