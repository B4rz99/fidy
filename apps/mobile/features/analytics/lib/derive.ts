import { formatMoney, formatSignedMoney, toIsoDate } from "@/shared/lib";
import type { CategoryId, CopAmount, IsoDate } from "@/shared/types/branded";

export type AnalyticsPeriod = "W" | "M" | "Q" | "Y";
export type DeltaTrend = "increased" | "decreased" | "unchanged";

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
    readonly trend: DeltaTrend;
  }[];
};

export type PeriodShiftView = {
  readonly totalDeltaPercentText: string;
  readonly totalDeltaAmountText: string;
  readonly totalDeltaAbsoluteAmountText: string;
  readonly totalDeltaDirection: "increased" | "decreased" | "unchanged";
  readonly categoryBars: readonly {
    readonly categoryId: CategoryId;
    readonly total: CopAmount;
    readonly heightPercent: number;
  }[];
  readonly categoryChanges: readonly {
    readonly categoryId: CategoryId;
    readonly deltaText: string;
    readonly trend: DeltaTrend;
  }[];
};

/** Returns a Date offset by `days` relative to `base` (negative = in the past). */
const offsetDate = (base: Date, days: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);

/**
 * Computes a percentage change from `prev` to `curr`, rounded to nearest integer.
 * When prev is 0: returns 100 if curr > 0, otherwise 0.
 */
const computeDeltaPercent = (curr: number, prev: number): number => {
  if (prev > 0) return Math.round(((curr - prev) / prev) * 100);
  if (curr > 0) return 100;
  return 0;
};

const formatSignedPercent = (percent: number): string =>
  percent === 0 ? "0%" : `${percent > 0 ? "+" : "-"}${Math.abs(percent)}%`;

const getDeltaDirection = (amount: number): DeltaTrend => {
  if (amount > 0) return "increased";
  if (amount < 0) return "decreased";
  return "unchanged";
};

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
 * Missing category totals in either period are treated as 0.
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
  const currentByCategory = new Map(
    current.categorySpending.map((item) => [item.categoryId, item.total])
  );
  const categoryIds = Array.from(
    new Set([
      ...current.categorySpending.map((item) => item.categoryId),
      ...previous.categorySpending.map((item) => item.categoryId),
    ])
  );

  const categoryDeltas = categoryIds.map((categoryId) => {
    const currentTotal = (currentByCategory.get(categoryId) ?? 0) as CopAmount;
    const previousTotal = (previousByCategory.get(categoryId) ?? 0) as CopAmount;
    const delta = (currentTotal - previousTotal) as CopAmount;
    const deltaPercent = computeDeltaPercent(currentTotal, previousTotal);
    return {
      categoryId,
      delta,
      deltaPercent,
      trend: getDeltaDirection(delta),
    };
  });

  return {
    totalDelta,
    totalDeltaPercent,
    spendingIncreased: totalDelta > 0,
    categoryDeltas,
  };
}

export function derivePeriodShiftView(input: {
  readonly categoryBreakdown: readonly CategoryBreakdownItem[];
  readonly periodDelta: PeriodDelta;
}): PeriodShiftView {
  const maxCategoryTotal = Math.max(...input.categoryBreakdown.map((item) => item.total), 1);
  const deltaByCategory = new Map(
    input.periodDelta.categoryDeltas.map((item) => [item.categoryId, item])
  );
  const breakdownCategoryIds = new Set(input.categoryBreakdown.map((item) => item.categoryId));
  const droppedCategoryIds = input.periodDelta.categoryDeltas
    .map((item) => item.categoryId)
    .filter((categoryId) => !breakdownCategoryIds.has(categoryId));
  const categoryChangeIds = [
    ...droppedCategoryIds,
    ...input.categoryBreakdown.map((item) => item.categoryId),
  ];

  return {
    totalDeltaPercentText: formatSignedPercent(input.periodDelta.totalDeltaPercent),
    totalDeltaAmountText: formatSignedMoney(input.periodDelta.totalDelta),
    totalDeltaAbsoluteAmountText: formatMoney(Math.abs(input.periodDelta.totalDelta)),
    totalDeltaDirection: getDeltaDirection(input.periodDelta.totalDelta),
    categoryBars: input.categoryBreakdown.map((item) => ({
      categoryId: item.categoryId,
      total: item.total,
      heightPercent: Math.round((item.total / maxCategoryTotal) * 100),
    })),
    categoryChanges: categoryChangeIds
      .map((categoryId) => deltaByCategory.get(categoryId))
      .filter((item): item is NonNullable<typeof item> => item != null)
      .map((item) => ({
        categoryId: item.categoryId,
        deltaText: `${formatSignedMoney(item.delta)} (${formatSignedPercent(item.deltaPercent)})`,
        trend: item.trend,
      })),
  };
}
