import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { useBudgetStore } from "../../store";
import { AuthenticatedCreateBudgetForm } from "./AuthenticatedCreateBudgetForm";
import { CreateBudgetForm } from "./CreateBudgetForm";
import {
  disabledCreateBudgetMutations,
  resolveBudgetIdParam,
  resolveExistingBudget,
  resolveExistingCategoryIds,
} from "./CreateBudgetScreen.helpers";

export function CreateBudgetScreen() {
  const { back } = useRouter();
  const { budgetId } = useLocalSearchParams<{ budgetId?: string | string[] }>();
  const autoSuggestions = useBudgetStore((state) => state.autoSuggestions);
  const budgets = useBudgetStore((state) => state.budgets);
  const userId = useOptionalUserId();
  const resolvedBudgetId = resolveBudgetIdParam(budgetId);
  const existingBudget = resolveExistingBudget(budgets, resolvedBudgetId);
  const existingCategoryIds = useMemo(
    () => resolveExistingCategoryIds(budgets, resolvedBudgetId),
    [budgets, resolvedBudgetId]
  );
  const sharedProps = {
    autoSuggestions,
    existingBudget,
    existingCategoryIds,
    onDone: () => back(),
  };

  if (!userId) {
    return <CreateBudgetForm {...sharedProps} {...disabledCreateBudgetMutations} />;
  }

  return <AuthenticatedCreateBudgetForm {...sharedProps} userId={userId} />;
}
