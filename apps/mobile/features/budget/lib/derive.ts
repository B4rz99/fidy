import { differenceInCalendarDays, endOfMonth } from "date-fns";
import type { BudgetId, CategoryId, CopAmount, Month } from "@/shared/types/branded";

export type BudgetProgress = {
  readonly budgetId: BudgetId;
  readonly categoryId: CategoryId;
  readonly amount: CopAmount;
  readonly spent: CopAmount;
  readonly percentUsed: number; // 0–100+ (can exceed 100)
  readonly remaining: CopAmount; // negative if over budget
  readonly isOverBudget: boolean;
  readonly isNearLimit: boolean; // >= 80%
};

export type BudgetAlert = {
  readonly budgetId: BudgetId;
  readonly categoryId: CategoryId;
  readonly threshold: 80 | 100;
  readonly percentUsed: number;
  readonly suggestionKey: string | undefined;
  readonly daysLeft: number;
  readonly remainingAmount: CopAmount;
};

export type BudgetSuggestion = {
  readonly categoryId: CategoryId;
  readonly suggestedAmount: CopAmount;
};

/** Pure derivation: compute progress for a single budget given its total spent. */
export function deriveBudgetProgress(
  budget: { readonly id: BudgetId; readonly categoryId: CategoryId; readonly amount: CopAmount },
  spent: CopAmount
): BudgetProgress {
  const percentUsed = (() => {
    if (budget.amount > 0) return Math.round((spent / budget.amount) * 100);
    if (spent > 0) return 100;
    return 0;
  })();
  const remaining = (budget.amount - spent) as CopAmount;
  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    amount: budget.amount,
    spent,
    percentUsed,
    remaining,
    isOverBudget: spent > budget.amount,
    isNearLimit: percentUsed >= 80,
  };
}

/** Pure derivation: aggregate totals across all budget progresses. */
export function deriveBudgetSummary(progresses: readonly BudgetProgress[]): {
  readonly totalBudget: number;
  readonly totalSpent: number;
  readonly percentUsed: number;
} {
  const { totalBudget, totalSpent } = progresses.reduce(
    (acc, p) => ({
      totalBudget: acc.totalBudget + p.amount,
      totalSpent: acc.totalSpent + p.spent,
    }),
    { totalBudget: 0, totalSpent: 0 }
  );
  const percentUsed = (() => {
    if (totalBudget > 0) return Math.round((totalSpent / totalBudget) * 100);
    if (totalSpent > 0) return 100;
    return 0;
  })();
  return { totalBudget, totalSpent, percentUsed };
}

/**
 * Rounds an amount UP to the nearest "clean" COP amount.
 * COP amounts are whole numbers (no centavos in practice), so rounding
 * targets scale with magnitude:
 *   < 100,000 COP  → nearest 1,000 COP
 *   < 1,000,000 COP → nearest 10,000 COP
 *   >= 1,000,000 COP → nearest 100,000 COP
 */
const roundUpCop = (amount: number): number => {
  const unit = (() => {
    if (amount < 100_000) return 1_000;
    if (amount < 1_000_000) return 10_000;
    return 100_000;
  })();
  return Math.ceil(amount / unit) * unit;
};

/**
 * Pure derivation: suggest budgets for categories that have prior-month spending
 * but no existing budget this month.
 * Suggested amount is rounded UP to the nearest clean COP amount.
 */
export function deriveAutoSuggestBudgets(
  lastMonthSpending: readonly { readonly categoryId: CategoryId; readonly total: CopAmount }[],
  existingBudgetCategoryIds: ReadonlySet<CategoryId>
): readonly BudgetSuggestion[] {
  return lastMonthSpending
    .filter((s) => !existingBudgetCategoryIds.has(s.categoryId))
    .map((s) => ({
      categoryId: s.categoryId,
      suggestedAmount: roundUpCop(s.total) as CopAmount,
    }));
}

/**
 * Pure helper: returns the number of calendar days remaining in the given
 * budget month, clamped to 0 (never negative).
 */
export const computeDaysLeft = (month: Month, today: Date): number => {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  return Math.max(0, differenceInCalendarDays(endOfMonth(new Date(year, m - 1, 1)), today));
};

/**
 * Category IDs that have dedicated suggestion i18n keys (guidance.budgetAlertNN.xxx).
 * Intentionally separate from CATEGORIES — custom categories (#8) won't have suggestions.
 */
const SUGGESTION_CATEGORY_IDS: ReadonlySet<string> = new Set([
  "food",
  "transport",
  "entertainment",
  "health",
  "education",
  "home",
  "clothing",
  "services",
  "transfer",
  "other",
]);

/**
 * Returns the i18n key for a budget alert suggestion if the category is known,
 * otherwise returns undefined.
 */
const getSuggestionKey = (threshold: 80 | 100, categoryId: CategoryId): string | undefined =>
  SUGGESTION_CATEGORY_IDS.has(categoryId)
    ? `guidance.budgetAlert${threshold}.${categoryId}`
    : undefined;

/**
 * Pure derivation: generate alerts for budgets that have crossed 80% or 100%.
 * Acknowledged alerts (keyed as "budgetId:threshold") are excluded.
 * daysLeft must be >= 0 (caller is responsible — use computeDaysLeft).
 */
export function deriveBudgetAlerts(
  progresses: readonly BudgetProgress[],
  acknowledgedAlerts: ReadonlySet<string>,
  daysLeft: number
): readonly BudgetAlert[] {
  return progresses.flatMap((p) => {
    // If over 100%, only show the 100% alert — the 80% alert is superseded
    const applicableThresholds = (() => {
      if (p.percentUsed >= 100) return [100] as const;
      if (p.percentUsed >= 80) return [80] as const;
      return [] as const;
    })();
    return applicableThresholds
      .filter((threshold) => !acknowledgedAlerts.has(`${p.budgetId}:${threshold}`))
      .map((threshold) => ({
        budgetId: p.budgetId,
        categoryId: p.categoryId,
        threshold,
        percentUsed: p.percentUsed,
        suggestionKey: getSuggestionKey(threshold, p.categoryId),
        daysLeft,
        remainingAmount: p.remaining,
      }));
  });
}
