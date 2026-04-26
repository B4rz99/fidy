import { generateBudgetId } from "@/shared/lib";
import type { BudgetId } from "@/shared/types/branded";

export function createBudgetCopyId(): BudgetId {
  return generateBudgetId();
}
