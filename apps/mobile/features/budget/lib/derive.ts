import type { BudgetId, CategoryId, CopAmount } from "@/shared/types/branded";

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
  const percentUsed =
    budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : spent > 0 ? 100 : 0;
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
  const percentUsed =
    totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : totalSpent > 0 ? 100 : 0;
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
  const unit = amount < 100_000 ? 1_000 : amount < 1_000_000 ? 10_000 : 100_000;
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
 * Pure derivation: generate alerts for budgets that have crossed 80% or 100%.
 * Acknowledged alerts (keyed as "budgetId:threshold") are excluded.
 */
export function deriveBudgetAlerts(
  progresses: readonly BudgetProgress[],
  acknowledgedAlerts: ReadonlySet<string>
): readonly BudgetAlert[] {
  return progresses.flatMap((p) =>
    ([80, 100] as const)
      .filter((threshold) => p.percentUsed >= threshold)
      .filter((threshold) => !acknowledgedAlerts.has(`${p.budgetId}:${threshold}`))
      .map((threshold) => ({
        budgetId: p.budgetId,
        categoryId: p.categoryId,
        threshold,
        percentUsed: p.percentUsed,
      }))
  );
}
