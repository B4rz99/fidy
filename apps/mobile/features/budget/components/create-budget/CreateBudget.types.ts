import type { SetStateAction } from "react";
import type { CategoryId } from "@/shared/categories";
import type { BudgetId, CopAmount, UserId } from "@/shared/types/branded";
import type { BudgetSuggestion } from "../../lib/derive";
import type { Budget } from "../../schema";

export type CreateBudgetMutations = {
  readonly canMutate: boolean;
  readonly onCreateBudget: (categoryId: CategoryId, amount: CopAmount) => Promise<boolean>;
  readonly onDeleteBudget: (id: BudgetId) => Promise<boolean>;
  readonly onDone: () => void;
  readonly onUpdateBudget: (
    id: BudgetId,
    categoryId: CategoryId,
    amount: CopAmount
  ) => Promise<boolean>;
};

export type CreateBudgetFormProps = CreateBudgetMutations & {
  readonly autoSuggestions: readonly BudgetSuggestion[];
  readonly existingBudget: Budget | undefined;
  readonly existingCategoryIds: ReadonlySet<string>;
  readonly headerTitle: string;
};

export type CreateBudgetScreenProps = {
  readonly autoSuggestions: readonly BudgetSuggestion[];
  readonly existingBudget: Budget | undefined;
  readonly existingCategoryIds: ReadonlySet<string>;
  readonly headerTitle: string;
  readonly onDone: () => void;
  readonly userId: UserId | null | undefined;
};

export type CreateBudgetDraftState = {
  readonly category: CategoryId | null;
  readonly digits: string;
};

export type CreateBudgetDraftController = {
  readonly draft: CreateBudgetDraftState;
  readonly isEdit: boolean;
  readonly setCategory: (category: CategoryId) => void;
  readonly setDigits: (digits: SetStateAction<string>) => void;
};
