import { toIsoDate } from "@/shared/lib";
import type { CategoryId, CopAmount, IsoDate } from "@/shared/types/branded";

export type AnalyticsPeriod = "W" | "M" | "Q" | "Y";

export type PeriodRange = {
  readonly current: { readonly start: IsoDate; readonly end: IsoDate };
  readonly previous: { readonly start: IsoDate; readonly end: IsoDate };
};

export type IncomeExpenseResult = {
  readonly income: CopAmount;
  readonly expenses: CopAmount;
  readonly net: CopAmount;
  readonly netIsPositive: boolean;
};

export type CategoryBreakdownItem = {
  readonly categoryId: CategoryId;
  readonly total: CopAmount;
  readonly percent: number;
};

export type PeriodDelta = {
  readonly totalDelta: CopAmount;
  readonly totalDeltaPercent: number;
  readonly spendingIncreased: boolean;
  readonly categoryDeltas: readonly {
    readonly categoryId: CategoryId;
    readonly delta: CopAmount;
    readonly deltaPercent: number;
    readonly increased: boolean;
  }[];
};

/** Returns a Date offset by `days` relative to `base` (negative = in the past). */
const offsetDate = (base: Date, days: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);

/**
 * Computes a percentage change from `prev` to `curr`, rounded to nearest integer.
 * When prev is 0: returns 100 if curr > 0, otherwise 0.
 */
const computeDeltaPercent = (curr: number, prev: number): number =>
  prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;

/** Period window sizes in days (inclusive range length - 1). */
const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
  W: 6,
  // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
  M: 29,
  // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
  Q: 89,
  // biome-ignore lint/style/useNamingConvention: AnalyticsPeriod keys are single uppercase letters by design
  Y: 364,
};

/**
 * Pure derivation: compute current and previous period date ranges for a given
 * AnalyticsPeriod relative to today.
 *
 * - W:  current = today-6d → today,   previous = today-13d → today-7d
 * - M:  current = today-29d → today,  previous = today-59d → today-30d
 * - Q:  current = today-89d → today,  previous = today-179d → today-90d
 * - Y:  current = today-364d → today, previous = today-729d → today-365d
 */
export function computePeriodRange(period: AnalyticsPeriod, today: Date): PeriodRange {
  const windowDays = PERIOD_DAYS[period];
  const currentStart = offsetDate(today, -windowDays);
  const previousEnd = offsetDate(today, -(windowDays + 1));
  const previousStart = offsetDate(today, -(windowDays * 2 + 1));

  return {
    current: {
      start: toIsoDate(currentStart),
      end: toIsoDate(today),
    },
    previous: {
      start: toIsoDate(previousStart),
      end: toIsoDate(previousEnd),
    },
  };
}

/**
 * Pure derivation: compute income/expense summary including net and sign.
 */
export function deriveIncomeExpense(income: CopAmount, expenses: CopAmount): IncomeExpenseResult {
  const net = (income - expenses) as CopAmount;
  return {
    income,
    expenses,
    net,
    netIsPositive: net >= 0,
  };
}

/**
 * Pure derivation: compute per-category percentage breakdown of total expenses.
 * Returns items sorted descending by total.
 * If totalExpenses is 0, all percents are 0.
 */
export function deriveCategoryBreakdown(
  spending: readonly { readonly categoryId: CategoryId; readonly total: CopAmount }[],
  totalExpenses: CopAmount
): readonly CategoryBreakdownItem[] {
  return spending
    .map((item) => ({
      categoryId: item.categoryId,
      total: item.total,
      percent: totalExpenses === 0 ? 0 : Math.round((item.total / totalExpenses) * 100),
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Pure derivation: compute spending deltas between current and previous periods.
 * For categories present in current but not in previous, previous total is treated as 0.
 */
export function derivePeriodDelta(
  current: {
    readonly totalExpenses: CopAmount;
    readonly categorySpending: readonly {
      readonly categoryId: CategoryId;
      readonly total: CopAmount;
    }[];
  },
  previous: {
    readonly totalExpenses: CopAmount;
    readonly categorySpending: readonly {
      readonly categoryId: CategoryId;
      readonly total: CopAmount;
    }[];
  }
): PeriodDelta {
  const totalDelta = (current.totalExpenses - previous.totalExpenses) as CopAmount;

  const totalDeltaPercent = computeDeltaPercent(current.totalExpenses, previous.totalExpenses);

  const previousByCategory = new Map(
    previous.categorySpending.map((item) => [item.categoryId, item.total])
  );

  const categoryDeltas = current.categorySpending.map((item) => {
    const previousTotal = (previousByCategory.get(item.categoryId) ?? 0) as CopAmount;
    const delta = (item.total - previousTotal) as CopAmount;
    const deltaPercent = computeDeltaPercent(item.total, previousTotal);
    return {
      categoryId: item.categoryId,
      delta,
      deltaPercent,
      increased: delta > 0,
    };
  });

  return {
    totalDelta,
    totalDeltaPercent,
    spendingIncreased: totalDelta > 0,
    categoryDeltas,
  };
}
