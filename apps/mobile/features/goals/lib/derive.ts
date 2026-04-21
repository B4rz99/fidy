import { addMonths, differenceInDays } from "date-fns";
import { parseIsoDate } from "@/shared/lib";
import { requireIsoDate } from "@/shared/types/assertions";
import type { CopAmount } from "@/shared/types/branded";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GoalProgress = {
  readonly percentComplete: number;
  readonly remaining: number;
  readonly isComplete: boolean;
};

export type MonthlyTotal = {
  readonly month: string; // "YYYY-MM"
  readonly type: string; // "income" | "expense"
  readonly total: number;
};

export type ConfidenceTier = "none" | "low" | "medium" | "high";

export type GoalProjection = {
  readonly projectedDate: Date | null;
  readonly monthsToGo: number | null;
  readonly confidence: ConfidenceTier;
  readonly netMonthlySavings: number;
};

export type DebtProjectionResult =
  | {
      readonly status: "ok";
      readonly monthsToGo: number;
      readonly projectedDate: Date;
    }
  | { readonly status: "complete"; readonly monthsToGo: 0 }
  | { readonly status: "payment_too_low" }
  | {
      readonly status: "zero_rate";
      readonly monthsToGo: number;
      readonly projectedDate: Date;
    };

export type Milestone = {
  readonly month: Date;
  readonly cumulativeTarget: number;
  readonly isCompleted: boolean;
};

export type InstallmentProgress = {
  readonly current: number;
  readonly total: number;
};

export type BudgetNudge = {
  readonly categoryId: string;
  readonly currentSpending: number;
  readonly suggestedReduction: number;
  readonly monthsSaved: number;
};

export type GoalAlert = {
  readonly goalId: string;
  readonly goalName: string;
  readonly shiftMonths: number;
};

type MonthSummary = {
  readonly income: number;
  readonly expense: number;
};

type GoalProjectionStats = {
  readonly confidence: ConfidenceTier;
  readonly netMonthlySavings: number;
};

type BudgetNudgeSpending = {
  readonly categoryId: string;
  readonly total: number;
};

type BudgetNudgeInput = {
  readonly currentAmount: number;
  readonly targetAmount: number;
  readonly netMonthlySavings: number;
  readonly spendingByCategory: readonly BudgetNudgeSpending[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the median of a readonly numeric array. Pure, no mutation. */
export function computeMedian(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = sortNumbers(values);
  const mid = getMedianIndex(sorted.length);
  return isEvenLength(sorted.length) ? getEvenMedian(sorted, mid) : getValueAt(sorted, mid);
}

const sortNumbers = (values: readonly number[]): readonly number[] =>
  [...values].sort(compareNumbersAscending);

const compareNumbersAscending = (left: number, right: number): number => left - right;

const getMedianIndex = (length: number): number => Math.floor(length / 2);

const isEvenLength = (length: number): boolean => length % 2 === 0;

const getValueAt = (values: readonly number[], index: number): number => values[index] ?? 0;

const getEvenMedian = (sorted: readonly number[], mid: number): number =>
  (getValueAt(sorted, mid - 1) + getValueAt(sorted, mid)) / 2;

const confidenceFromMonthCount = (count: number): ConfidenceTier => {
  if (count === 0) return "none";
  if (count === 1) return "low";
  if (count === 2) return "medium";
  return "high";
};

const updateMonthSummary = (summary: MonthSummary, total: MonthlyTotal): MonthSummary =>
  total.type === "income"
    ? { ...summary, income: summary.income + total.total }
    : { ...summary, expense: summary.expense + total.total };

const groupMonthlyTotals = (
  monthlyTotals: readonly MonthlyTotal[]
): ReadonlyMap<string, MonthSummary> =>
  monthlyTotals.reduce<Map<string, MonthSummary>>((acc, total) => {
    const current = acc.get(total.month) ?? { income: 0, expense: 0 };
    acc.set(total.month, updateMonthSummary(current, total));
    return acc;
  }, new Map());

const getNetMonthlySavings = (monthSummaries: readonly MonthSummary[]): number => {
  const incomes = monthSummaries.map((entry) => entry.income);
  const expenses = monthSummaries.map((entry) => entry.expense);
  return computeMedian(incomes) - computeMedian(expenses);
};

const getGoalProjectionStats = (monthlyTotals: readonly MonthlyTotal[]): GoalProjectionStats => {
  const monthGroups = groupMonthlyTotals(monthlyTotals);
  return {
    confidence: confidenceFromMonthCount(monthGroups.size),
    netMonthlySavings: getNetMonthlySavings([...monthGroups.values()]),
  };
};

const buildCompletedProjection = (
  confidence: ConfidenceTier,
  netMonthlySavings: number
): GoalProjection => ({
  monthsToGo: 0,
  projectedDate: new Date(),
  confidence,
  netMonthlySavings,
});

const buildUnavailableProjection = (
  confidence: ConfidenceTier,
  netMonthlySavings: number
): GoalProjection => ({
  monthsToGo: null,
  projectedDate: null,
  confidence,
  netMonthlySavings,
});

const buildProjectedGoalResult = (
  remaining: number,
  confidence: ConfidenceTier,
  netMonthlySavings: number
): GoalProjection => {
  const monthsToGo = Math.ceil(remaining / netMonthlySavings);
  return {
    monthsToGo,
    projectedDate: addMonths(new Date(), monthsToGo),
    confidence,
    netMonthlySavings,
  };
};

// ---------------------------------------------------------------------------
// 1. deriveGoalProgress
// ---------------------------------------------------------------------------

export function deriveGoalProgress(
  goal: { readonly targetAmount: number },
  currentAmount: number
): GoalProgress {
  const percentComplete =
    goal.targetAmount > 0
      ? Math.round((currentAmount / goal.targetAmount) * 100)
      : currentAmount > 0
        ? 100
        : 0;

  const remaining = goal.targetAmount - currentAmount;
  const isComplete = currentAmount >= goal.targetAmount;

  return { percentComplete, remaining, isComplete };
}

// ---------------------------------------------------------------------------
// 2. deriveGoalProjection
// ---------------------------------------------------------------------------

export function deriveGoalProjection(
  goal: { readonly targetAmount: number; readonly type: string },
  currentAmount: number,
  monthlyTotals: readonly MonthlyTotal[]
): GoalProjection {
  const { confidence, netMonthlySavings } = getGoalProjectionStats(monthlyTotals);
  const remaining = goal.targetAmount - currentAmount;
  if (remaining <= 0) return buildCompletedProjection(confidence, netMonthlySavings);
  if (netMonthlySavings <= 0) return buildUnavailableProjection(confidence, netMonthlySavings);
  return buildProjectedGoalResult(remaining, confidence, netMonthlySavings);
}

// ---------------------------------------------------------------------------
// 3. deriveDebtProjection
// ---------------------------------------------------------------------------

export function deriveDebtProjection(
  goal: {
    readonly targetAmount: number;
    readonly interestRatePercent: number | null;
  },
  currentAmount: number,
  monthlyPayment: number
): DebtProjectionResult {
  const monthlyRate = (goal.interestRatePercent ?? 0) / 100 / 12;
  const remaining = goal.targetAmount - currentAmount;

  // Already paid off
  if (remaining <= 0) {
    return { status: "complete", monthsToGo: 0 as const };
  }

  // Zero interest — simple division
  if (monthlyRate === 0) {
    if (monthlyPayment <= 0) {
      return { status: "payment_too_low" };
    }
    const monthsToGo = Math.ceil(remaining / monthlyPayment);
    return {
      status: "zero_rate",
      monthsToGo,
      projectedDate: addMonths(new Date(), monthsToGo),
    };
  }

  // Payment too low to cover interest
  if (monthlyPayment <= remaining * monthlyRate) {
    return { status: "payment_too_low" };
  }

  // Standard amortization formula
  const logArg = 1 - (remaining * monthlyRate) / monthlyPayment;

  // Guard against NaN/Infinity from log
  if (logArg <= 0) {
    return { status: "payment_too_low" };
  }

  const monthsToGo = Math.ceil(-Math.log(logArg) / Math.log(1 + monthlyRate));

  // Final guard — ensure finite result
  if (!Number.isFinite(monthsToGo) || Number.isNaN(monthsToGo)) {
    return { status: "payment_too_low" };
  }

  return {
    status: "ok",
    monthsToGo,
    projectedDate: addMonths(new Date(), monthsToGo),
  };
}

// ---------------------------------------------------------------------------
// 4. deriveMonthlyMilestones
// ---------------------------------------------------------------------------

export function deriveMonthlyMilestones(
  currentAmount: number,
  monthlyTarget: number,
  monthsToGo: number
): readonly Milestone[] {
  return Array.from({ length: monthsToGo }, (_, i) => ({
    month: addMonths(new Date(), i + 1),
    cumulativeTarget: currentAmount + monthlyTarget * (i + 1),
    isCompleted: false,
  }));
}

// ---------------------------------------------------------------------------
// 5. deriveInstallmentProgress
// ---------------------------------------------------------------------------

export function deriveInstallmentProgress(
  targetAmount: number,
  netMonthlySavings: number,
  contributionMonths: number
): InstallmentProgress {
  const total = netMonthlySavings > 0 ? Math.ceil(targetAmount / netMonthlySavings) : 0;
  return { current: contributionMonths, total };
}

// ---------------------------------------------------------------------------
// 6. deriveBudgetNudges
// ---------------------------------------------------------------------------

export function deriveBudgetNudges(input: BudgetNudgeInput): readonly BudgetNudge[] {
  if (input.netMonthlySavings <= 0) return [];

  const remaining = input.targetAmount - input.currentAmount;
  if (remaining <= 0) return [];

  const baselineMonths = Math.ceil(remaining / input.netMonthlySavings);
  const nudges = getTopSpendingCategories(input.spendingByCategory).map((category) =>
    buildBudgetNudge(category, remaining, baselineMonths, input.netMonthlySavings)
  );
  return nudges.sort((left, right) => right.monthsSaved - left.monthsSaved);
}

const getTopSpendingCategories = (
  spendingByCategory: readonly BudgetNudgeSpending[]
): readonly BudgetNudgeSpending[] =>
  [...spendingByCategory].sort((left, right) => right.total - left.total).slice(0, 3);

const buildBudgetNudge = (
  category: BudgetNudgeSpending,
  remaining: number,
  baselineMonths: number,
  netMonthlySavings: number
): BudgetNudge => {
  const suggestedReduction = Math.round(category.total * 0.15);
  const newSavings = netMonthlySavings + suggestedReduction;
  const newMonths = newSavings > 0 ? Math.ceil(remaining / newSavings) : baselineMonths;
  return {
    categoryId: category.categoryId,
    currentSpending: category.total,
    suggestedReduction,
    monthsSaved: baselineMonths - newMonths,
  };
};

// ---------------------------------------------------------------------------
// 7. deriveGoalAlerts
// ---------------------------------------------------------------------------

export function deriveGoalAlerts(
  goals: readonly {
    readonly id: string;
    readonly name: string;
    readonly currentMonthsToGo: number | null;
  }[],
  previousProjections: ReadonlyMap<string, number>
): readonly GoalAlert[] {
  return goals
    .filter((g) => {
      if (g.currentMonthsToGo === null) return false;
      const prev = previousProjections.get(g.id);
      if (prev === undefined) return false;
      return Math.abs(g.currentMonthsToGo - prev) >= 1;
    })
    .map((g) => {
      const current = g.currentMonthsToGo ?? 0;
      const prev = previousProjections.get(g.id) ?? 0;
      return { goalId: g.id, goalName: g.name, shiftMonths: current - prev };
    });
}

// ---------------------------------------------------------------------------
// 8. deriveGoalPaceGuidance
// ---------------------------------------------------------------------------

export type GoalPaceGuidance =
  | { readonly type: "pace_ahead"; readonly amountAhead: CopAmount }
  | {
      readonly type: "pace_behind";
      readonly amountBehind: CopAmount;
      readonly reason: "no_contributions" | "below_pace";
    };

export function deriveGoalPaceGuidance(
  goal: {
    readonly targetAmount: number;
    readonly targetDate: string | null;
    readonly createdAt: string;
  },
  currentAmount: number,
  hasContributions: boolean,
  today: Date = new Date()
): GoalPaceGuidance | null {
  if (currentAmount >= goal.targetAmount) return null;
  if (goal.targetDate === null) return null;
  // amountBehind is 0 as a sentinel; consumers must check reason === "no_contributions"
  // to distinguish from an actual zero-delta below-pace scenario
  if (!hasContributions) {
    return { type: "pace_behind", amountBehind: 0 as CopAmount, reason: "no_contributions" };
  }

  // createdAt is always stored as UTC ISO 8601 via toIsoDateTime(); slice(0,10) extracts the
  // UTC calendar date "YYYY-MM-DD" which is the canonical start of the goal timeline.
  // targetDate is validated as YYYY-MM-DD by Zod before storage, so the cast is safe.
  const start = parseIsoDate(requireIsoDate(goal.createdAt.slice(0, 10)));
  const end = parseIsoDate(requireIsoDate(goal.targetDate));
  const totalDays = differenceInDays(end, start);
  if (totalDays <= 0) return null;

  const elapsedDays = Math.max(0, Math.min(differenceInDays(today, start), totalDays));
  const expectedNow = goal.targetAmount * (elapsedDays / totalDays);
  const delta = currentAmount - expectedNow;

  return delta >= 0
    ? { type: "pace_ahead", amountAhead: Math.round(delta) as CopAmount }
    : { type: "pace_behind", amountBehind: Math.round(-delta) as CopAmount, reason: "below_pace" };
}

// ---------------------------------------------------------------------------
// 9. deriveGoalCardStatus
// ---------------------------------------------------------------------------

export type GoalCardStatus =
  | { readonly kind: "completed" }
  | { readonly kind: "pace_ahead"; readonly amount: CopAmount }
  | { readonly kind: "pace_behind"; readonly amount: CopAmount }
  | { readonly kind: "start_saving" }
  | { readonly kind: "almost_there" };

export function deriveGoalCardStatus(
  progress: GoalProgress,
  paceGuidance: GoalPaceGuidance | null
): GoalCardStatus | null {
  const progressStatus = getProgressStatus(progress);
  if (progressStatus?.kind === "completed") return progressStatus;
  if (paceGuidance !== null) return getPaceStatus(paceGuidance);
  return progressStatus;
}

const getProgressStatus = (progress: GoalProgress): GoalCardStatus | null => {
  if (progress.isComplete) return { kind: "completed" };
  if (progress.percentComplete >= 75) return { kind: "almost_there" };
  return null;
};

const getPaceStatus = (paceGuidance: GoalPaceGuidance): GoalCardStatus =>
  paceGuidance.type === "pace_ahead"
    ? { kind: "pace_ahead", amount: paceGuidance.amountAhead }
    : paceGuidance.reason === "no_contributions"
      ? { kind: "start_saving" }
      : { kind: "pace_behind", amount: paceGuidance.amountBehind };
