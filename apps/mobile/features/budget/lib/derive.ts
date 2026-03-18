export type BudgetProgress = {
  readonly budgetId: string;
  readonly categoryId: string;
  readonly amountCents: number;
  readonly spentCents: number;
  readonly percentUsed: number; // 0–100+ (can exceed 100)
  readonly remainingCents: number; // negative if over budget
  readonly isOverBudget: boolean;
  readonly isNearLimit: boolean; // >= 80%
};

export type BudgetAlert = {
  readonly budgetId: string;
  readonly categoryId: string;
  readonly threshold: 80 | 100;
  readonly percentUsed: number;
};

export type BudgetSuggestion = {
  readonly categoryId: string;
  readonly suggestedAmountCents: number;
};

/** Pure derivation: compute progress for a single budget given its total spent. */
export function deriveBudgetProgress(
  budget: { readonly id: string; readonly categoryId: string; readonly amountCents: number },
  spentCents: number
): BudgetProgress {
  const percentUsed =
    budget.amountCents > 0 ? Math.round((spentCents / budget.amountCents) * 100) : 0;
  const remainingCents = budget.amountCents - spentCents;
  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    amountCents: budget.amountCents,
    spentCents,
    percentUsed,
    remainingCents,
    isOverBudget: spentCents > budget.amountCents,
    isNearLimit: percentUsed >= 80,
  };
}

/** Pure derivation: aggregate totals across all budget progresses. */
export function deriveBudgetSummary(progresses: readonly BudgetProgress[]): {
  readonly totalBudgetCents: number;
  readonly totalSpentCents: number;
  readonly percentUsed: number;
} {
  const { totalBudgetCents, totalSpentCents } = progresses.reduce(
    (acc, p) => ({
      totalBudgetCents: acc.totalBudgetCents + p.amountCents,
      totalSpentCents: acc.totalSpentCents + p.spentCents,
    }),
    { totalBudgetCents: 0, totalSpentCents: 0 }
  );
  const percentUsed =
    totalBudgetCents > 0 ? Math.round((totalSpentCents / totalBudgetCents) * 100) : 0;
  return { totalBudgetCents, totalSpentCents, percentUsed };
}

/**
 * Pure derivation: suggest budgets for categories that have prior-month spending
 * but no existing budget this month.
 * Suggested amount is rounded UP to the nearest 100 cents.
 */
export function deriveAutoSuggestBudgets(
  lastMonthSpending: readonly { readonly categoryId: string; readonly totalCents: number }[],
  existingBudgetCategoryIds: ReadonlySet<string>
): readonly BudgetSuggestion[] {
  return lastMonthSpending
    .filter((s) => !existingBudgetCategoryIds.has(s.categoryId))
    .map((s) => ({
      categoryId: s.categoryId,
      suggestedAmountCents: Math.ceil(s.totalCents / 100) * 100,
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
