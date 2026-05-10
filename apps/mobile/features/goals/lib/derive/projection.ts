import { addMonths } from "date-fns";
import type {
  ConfidenceTier,
  DebtProjectionResult,
  GoalProgress,
  GoalProjection,
  InstallmentProgress,
  Milestone,
  MonthlyTotal,
} from "./types";

type MonthSummary = {
  readonly income: number;
  readonly expense: number;
};

type GoalProjectionStats = {
  readonly confidence: ConfidenceTier;
  readonly netMonthlySavings: number;
};

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

export function deriveGoalProgress(
  goal: { readonly targetAmount: number },
  currentAmount: number
): GoalProgress {
  const percentComplete = (() => {
    if (goal.targetAmount > 0) return Math.round((currentAmount / goal.targetAmount) * 100);
    if (currentAmount > 0) return 100;
    return 0;
  })();

  const remaining = goal.targetAmount - currentAmount;
  const isComplete = currentAmount >= goal.targetAmount;

  return { percentComplete, remaining, isComplete };
}

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

  if (remaining <= 0) {
    return { status: "complete", monthsToGo: 0 as const };
  }

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

  if (monthlyPayment <= remaining * monthlyRate) {
    return { status: "payment_too_low" };
  }

  const logArg = 1 - (remaining * monthlyRate) / monthlyPayment;
  if (logArg <= 0) {
    return { status: "payment_too_low" };
  }

  const monthsToGo = Math.ceil(-Math.log(logArg) / Math.log(1 + monthlyRate));
  if (!Number.isFinite(monthsToGo) || Number.isNaN(monthsToGo)) {
    return { status: "payment_too_low" };
  }

  return {
    status: "ok",
    monthsToGo,
    projectedDate: addMonths(new Date(), monthsToGo),
  };
}

export function deriveMonthlyMilestones(
  currentAmount: number,
  monthlyTarget: number,
  monthsToGo: number
): readonly Milestone[] {
  return Array.from({ length: monthsToGo }, (_, index) => ({
    month: addMonths(new Date(), index + 1),
    cumulativeTarget: currentAmount + monthlyTarget * (index + 1),
    isCompleted: false,
  }));
}

export function deriveInstallmentProgress(
  targetAmount: number,
  netMonthlySavings: number,
  contributionMonths: number
): InstallmentProgress {
  const total = netMonthlySavings > 0 ? Math.ceil(targetAmount / netMonthlySavings) : 0;
  return { current: contributionMonths, total };
}
