import { useCallback, useState } from "react";
import { isValidCategoryId } from "@/features/transactions";
import type { Budget } from "../../schema";
import type { CreateBudgetDraftController, CreateBudgetDraftState } from "./CreateBudget.types";

function resolveInitialCategory(existingBudget: Budget | undefined) {
  const categoryId = existingBudget?.categoryId;
  if (!categoryId) return null;
  return isValidCategoryId(categoryId) ? categoryId : null;
}

function resolveInitialDigits(existingBudget: Budget | undefined) {
  return existingBudget ? String(existingBudget.amount) : "";
}

function resolveInitialDraft(existingBudget: Budget | undefined): CreateBudgetDraftState {
  return {
    category: resolveInitialCategory(existingBudget),
    digits: resolveInitialDigits(existingBudget),
  };
}

export function useCreateBudgetDraft(
  existingBudget: Budget | undefined
): CreateBudgetDraftController {
  const [draft, setDraft] = useState(() => resolveInitialDraft(existingBudget));

  return {
    draft,
    isEdit: Boolean(existingBudget),
    setCategory: useCallback((category) => {
      setDraft((current) => ({ ...current, category }));
    }, []),
    setDigits: useCallback((digits) => {
      setDraft((current) => ({ ...current, digits }));
    }, []),
  };
}
