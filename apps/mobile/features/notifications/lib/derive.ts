import { addDays, differenceInDays, endOfDay, getDate, getDaysInMonth, startOfDay } from "date-fns";
import type { BudgetProgress } from "@/features/budget";
import { computeMedian } from "@/features/goals";
import type { StoredTransaction } from "@/features/transactions";
import type { BudgetId, CategoryId, CopAmount } from "@/shared/types/branded";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnomalyMove = {
  readonly type: "anomaly";
  readonly categoryId: CategoryId;
  readonly weeklySpend: CopAmount;
  readonly medianWeeklySpend: CopAmount;
  readonly impact: CopAmount;
};

type BudgetPaceMove = {
  readonly type: "budget_pace";
  readonly budgetId: BudgetId;
  readonly categoryId: CategoryId;
  readonly projectedSpend: CopAmount;
  readonly budgetAmount: CopAmount;
  readonly impact: CopAmount;
};

export type WeeklyMove = AnomalyMove | BudgetPaceMove;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const groupCurrentWeekExpenses = (
  expenses: readonly StoredTransaction[],
  weekStart: Date
): ReadonlyMap<CategoryId, CopAmount> => {
  const weekStartMs = weekStart.getTime();
  const weekEndMs = endOfDay(addDays(weekStart, 6)).getTime();

  return expenses.reduce<Map<CategoryId, CopAmount>>((acc, tx) => {
    const txTime = tx.date.getTime();
    if (txTime >= weekStartMs && txTime <= weekEndMs) {
      acc.set(tx.categoryId, ((acc.get(tx.categoryId) ?? 0) + tx.amount) as CopAmount);
    }
    return acc;
  }, new Map());
};

/**
 * Groups already-filtered prior expenses by categoryId, then by week bucket.
 * Bucket formula: Math.floor((differenceInDays(weekStart, txDate) - 1) / 7)
 * Returns a Map<CategoryId, Map<bucket, totalAmount>>
 */
const groupPriorWeeksByCategory = (
  priorExpenses: readonly StoredTransaction[],
  weekStart: Date
): ReadonlyMap<CategoryId, ReadonlyMap<number, CopAmount>> =>
  priorExpenses.reduce<Map<CategoryId, Map<number, CopAmount>>>((acc, tx) => {
    const daysApart = differenceInDays(startOfDay(weekStart), startOfDay(tx.date));
    const bucket = Math.floor((daysApart - 1) / 7);
    const catMap = acc.get(tx.categoryId) ?? new Map<number, CopAmount>();
    catMap.set(bucket, ((catMap.get(bucket) ?? 0) + tx.amount) as CopAmount);
    acc.set(tx.categoryId, catMap);
    return acc;
  }, new Map());

/**
 * Detects spending anomalies per category using median weekly spend of prior weeks.
 * Emits an AnomalyMove when this-week spend > 1.5 × medianWeeklySpend.
 * Requires at least 5 prior expense transactions for the category.
 */
const detectAnomalies = (
  expenses: readonly StoredTransaction[],
  weekStart: Date,
  currentWeekByCategory: ReadonlyMap<CategoryId, CopAmount>
): readonly AnomalyMove[] => {
  const weekStartMs = weekStart.getTime();
  const priorExpenses = expenses.filter((tx) => tx.date.getTime() < weekStartMs);
  const priorWeeksByCategory = groupPriorWeeksByCategory(priorExpenses, weekStart);

  // Count prior transactions per category to enforce the minimum-5 gate
  const priorCountByCategory = priorExpenses.reduce<Map<CategoryId, number>>((acc, tx) => {
    acc.set(tx.categoryId, (acc.get(tx.categoryId) ?? 0) + 1);
    return acc;
  }, new Map());

  return Array.from(priorWeeksByCategory.entries()).flatMap(([categoryId, weekTotalsMap]) => {
    const priorCount = priorCountByCategory.get(categoryId) ?? 0;
    if (priorCount < 5) return [];

    const weeklyTotals = Array.from(weekTotalsMap.values());
    const medianWeeklySpend = computeMedian(weeklyTotals);

    if (!Number.isFinite(medianWeeklySpend)) return [];

    const thisWeekSpend = currentWeekByCategory.get(categoryId) ?? 0;

    if (thisWeekSpend <= 1.5 * medianWeeklySpend) return [];

    return [
      {
        type: "anomaly" as const,
        categoryId,
        weeklySpend: thisWeekSpend as CopAmount,
        medianWeeklySpend: Math.round(medianWeeklySpend) as CopAmount,
        impact: Math.round(thisWeekSpend - medianWeeklySpend) as CopAmount,
      },
    ];
  });
};

/**
 * Detects budget pace issues by projecting end-of-month spend based on this week's daily rate.
 * Emits a BudgetPaceMove when projected spend exceeds the budget amount.
 */
const detectBudgetPaces = (
  currentWeekByCategory: ReadonlyMap<CategoryId, CopAmount>,
  budgetProgresses: readonly BudgetProgress[],
  weekStart: Date
): readonly BudgetPaceMove[] => {
  const daysInMonth = getDaysInMonth(weekStart);
  const dayOfMonth = getDate(weekStart);
  const remainingDays = daysInMonth - dayOfMonth + 1;

  return budgetProgresses.flatMap((bp) => {
    const thisWeekSpend = currentWeekByCategory.get(bp.categoryId) ?? 0;
    const weekDailyRate = thisWeekSpend / 7;
    const projected = bp.spent + weekDailyRate * remainingDays;

    if (!Number.isFinite(projected)) return [];
    if (projected <= bp.amount) return [];

    return [
      {
        type: "budget_pace" as const,
        budgetId: bp.budgetId,
        categoryId: bp.categoryId,
        projectedSpend: Math.round(projected) as CopAmount,
        budgetAmount: bp.amount,
        impact: Math.round(projected - bp.amount) as CopAmount,
      },
    ];
  });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function deriveWeeklyMoves(
  transactions: readonly StoredTransaction[],
  budgetProgresses: readonly BudgetProgress[],
  weekStart: Date
): readonly WeeklyMove[] {
  // Normalize to midnight so time-of-day on weekStart doesn't misclassify transactions
  const normalizedWeekStart = startOfDay(weekStart);
  const expenses = transactions.filter((tx) => tx.type === "expense");
  const currentWeekByCategory = groupCurrentWeekExpenses(expenses, normalizedWeekStart);
  const anomalies = detectAnomalies(expenses, normalizedWeekStart, currentWeekByCategory);
  const paces = detectBudgetPaces(currentWeekByCategory, budgetProgresses, normalizedWeekStart);

  return [...anomalies, ...paces].sort((a, b) => b.impact - a.impact).slice(0, 3);
}
