import { useState } from "react";
import { parseDigitsToAmount } from "@/shared/lib";
import type { CategoryId, CopAmount } from "@/shared/types/branded";
import type { BudgetSuggestion } from "../lib/derive";

export function useSuggestionSelection(autoSuggestions: readonly BudgetSuggestion[]) {
  const [deselectedIds, setDeselectedIds] = useState<ReadonlySet<string>>(new Set());
  const [amountOverrides, setAmountOverrides] = useState<Record<string, string>>({});

  const selectedIds = new Set(
    autoSuggestions.filter((s) => !deselectedIds.has(s.categoryId)).map((s) => s.categoryId)
  );

  const editedAmounts = Object.fromEntries(
    autoSuggestions.map((s) => [
      s.categoryId,
      amountOverrides[s.categoryId] ?? String(s.suggestedAmount),
    ])
  );

  const handleToggle = (categoryId: string) => {
    setDeselectedIds((prev) =>
      prev.has(categoryId)
        ? new Set(Array.from(prev).filter((id) => id !== categoryId))
        : new Set([...prev, categoryId])
    );
  };

  const handleAmountChange = (categoryId: string, value: string) => {
    setAmountOverrides((prev) => ({ ...prev, [categoryId]: value }));
  };

  const buildBudgetMap = (): ReadonlyMap<CategoryId, CopAmount> =>
    new Map(
      Array.from(selectedIds)
        .map(
          (categoryId) =>
            [
              categoryId,
              parseDigitsToAmount(editedAmounts[categoryId] ?? "0") as CopAmount,
            ] as const
        )
        .filter(([, amount]) => amount > 0)
    );

  return { selectedIds, editedAmounts, handleToggle, handleAmountChange, buildBudgetMap };
}
