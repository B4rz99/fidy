import { addMonths, differenceInDays } from "date-fns";
import { parseIsoDate } from "@/shared/lib/format-date";
import type { CopAmount, IsoDate } from "@/shared/types/branded";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the median of a readonly numeric array. Pure, no mutation. */
export function computeMedian(values: readonly number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0] ?? 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const confidenceFromMonthCount = (count: number): ConfidenceTier => {
  if (count === 0) return "none";
  if (count === 1) return "low";
  if (count === 2) return "medium";
  return "high";
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
  // Group by month, aggregate income and expense per month
  const byMonth = monthlyTotals.reduce<Map<string, { income: number; expense: number }>>(
    (acc, t) => {
      const existing = acc.get(t.month) ?? { income: 0, expense: 0 };
      const updated =
        t.type === "income"
          ? { ...existing, income: existing.income + t.total }
          : { ...existing, expense: existing.expense + t.total };
      acc.set(t.month, updated);
      return acc;
    },
    new Map()
  );

  const distinctMonths = byMonth.size;
  const confidence = confidenceFromMonthCount(distinctMonths);

  const monthEntries = [...byMonth.values()];
  const medianIncome = computeMedian(monthEntries.map((e) => e.income));
  const medianExpense = computeMedian(monthEntries.map((e) => e.expense));
  const netMonthlySavings = medianIncome - medianExpense;

  const remaining = goal.targetAmount - currentAmount;

  // Already complete
  if (remaining <= 0) {
    return {
      monthsToGo: 0,
      projectedDate: new Date(),
      confidence,
      netMonthlySavings,
    };
  }

  // Cannot project if no savings or no data
  if (netMonthlySavings <= 0) {
    return {
      monthsToGo: null,
      projectedDate: null,
      confidence,
      netMonthlySavings,
    };
  }

  const monthsToGo = Math.ceil(remaining / netMonthlySavings);
  const projectedDate = addMonths(new Date(), monthsToGo);

  return { monthsToGo, projectedDate, confidence, netMonthlySavings };
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

export function deriveBudgetNudges(
  currentAmount: number,
  targetAmount: number,
  netMonthlySavings: number,
  spendingByCategory: readonly {
    readonly categoryId: string;
    readonly total: number;
  }[]
): readonly BudgetNudge[] {
  if (netMonthlySavings <= 0) return [];

  const remaining = targetAmount - currentAmount;
  if (remaining <= 0) return [];

  const baselineMonths = Math.ceil(remaining / netMonthlySavings);

  // Top 3 categories by total, sorted descending
  const topCategories = [...spendingByCategory].sort((a, b) => b.total - a.total).slice(0, 3);

  const nudges = topCategories.map((cat) => {
    const suggestedReduction = Math.round(cat.total * 0.15);
    const newSavings = netMonthlySavings + suggestedReduction;
    const newMonths = newSavings > 0 ? Math.ceil(remaining / newSavings) : baselineMonths;
    const monthsSaved = baselineMonths - newMonths;

    return {
      categoryId: cat.categoryId,
      currentSpending: cat.total,
      suggestedReduction,
      monthsSaved,
    };
  });

  return [...nudges].sort((a, b) => b.monthsSaved - a.monthsSaved);
}

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
  const start = parseIsoDate(goal.createdAt.slice(0, 10) as IsoDate);
  const end = parseIsoDate(goal.targetDate as IsoDate);
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
  if (progress.isComplete) return { kind: "completed" };

  if (paceGuidance !== null) {
    if (paceGuidance.type === "pace_ahead") {
      return { kind: "pace_ahead", amount: paceGuidance.amountAhead };
    }
    if (paceGuidance.reason === "no_contributions") {
      return { kind: "start_saving" };
    }
    return { kind: "pace_behind", amount: paceGuidance.amountBehind };
  }

  if (progress.percentComplete >= 75) return { kind: "almost_there" };

  return null;
}
