import type { Budget } from "../../schema";
import type { CreateBudgetMutations } from "./CreateBudget.types";

const rejectCreateBudget: CreateBudgetMutations["onCreateBudget"] = async () => false;
const rejectDeleteBudget: CreateBudgetMutations["onDeleteBudget"] = async () => false;
const rejectUpdateBudget: CreateBudgetMutations["onUpdateBudget"] = async () => false;

export const disabledCreateBudgetMutations = {
  canMutate: false,
  onCreateBudget: rejectCreateBudget,
  onDeleteBudget: rejectDeleteBudget,
  onUpdateBudget: rejectUpdateBudget,
} satisfies Omit<CreateBudgetMutations, "onDone">;

export function resolveBudgetIdParam(budgetId: string | string[] | undefined) {
  return Array.isArray(budgetId) ? budgetId[0] : budgetId;
}

export function resolveExistingBudget(budgets: readonly Budget[], budgetId: string | undefined) {
  return budgetId ? budgets.find((budget) => budget.id === budgetId) : undefined;
}

export function resolveExistingCategoryIds(
  budgets: readonly Budget[],
  budgetId: string | undefined
): ReadonlySet<string> {
  return new Set(budgets.flatMap((budget) => (budget.id === budgetId ? [] : [budget.categoryId])));
}
