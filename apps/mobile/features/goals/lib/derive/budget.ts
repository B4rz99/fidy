import type { BudgetNudge, GoalAlert } from "./types";

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
  spendingByCategory.toSorted((left, right) => right.total - left.total).slice(0, 3);

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

export function deriveGoalAlerts(
  goals: readonly {
    readonly id: string;
    readonly name: string;
    readonly currentMonthsToGo: number | null;
  }[],
  previousProjections: ReadonlyMap<string, number>
): readonly GoalAlert[] {
  return goals.flatMap((goal) => {
    if (goal.currentMonthsToGo === null) return [];
    const previous = previousProjections.get(goal.id);
    if (previous === undefined || Math.abs(goal.currentMonthsToGo - previous) < 1) return [];
    return [
      { goalId: goal.id, goalName: goal.name, shiftMonths: goal.currentMonthsToGo - previous },
    ];
  });
}
