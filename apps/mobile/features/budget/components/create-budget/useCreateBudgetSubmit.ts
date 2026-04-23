import { useCallback } from "react";
import { useAsyncGuard } from "@/shared/hooks";
import { parseDigitsToAmount } from "@/shared/lib";
import type { Budget } from "../../schema";
import type {
  CreateBudgetDraftController,
  CreateBudgetDraftState,
  CreateBudgetMutations,
} from "./CreateBudget.types";

type UseCreateBudgetSubmitArgs = CreateBudgetMutations & {
  readonly draftController: CreateBudgetDraftController;
  readonly existingBudget: Budget | undefined;
};

function resolveAmount(digits: string) {
  return parseDigitsToAmount(digits);
}

async function saveExistingBudget(
  existingBudget: Budget,
  amount: ReturnType<typeof resolveAmount>,
  onDone: () => void,
  onUpdateBudget: CreateBudgetMutations["onUpdateBudget"]
) {
  const success = await onUpdateBudget(existingBudget.id, amount);
  if (success) onDone();
}

async function saveNewBudget(
  category: NonNullable<CreateBudgetDraftController["draft"]["category"]>,
  amount: ReturnType<typeof resolveAmount>,
  onCreateBudget: CreateBudgetMutations["onCreateBudget"],
  onDone: () => void
) {
  const success = await onCreateBudget(category, amount);
  if (success) onDone();
}

async function deleteExistingBudget(
  existingBudget: Budget | undefined,
  onDeleteBudget: CreateBudgetMutations["onDeleteBudget"],
  onDone: () => void
) {
  if (!existingBudget) return;
  const success = await onDeleteBudget(existingBudget.id);
  if (success) onDone();
}

async function runDelete(input: {
  readonly canMutate: boolean;
  readonly existingBudget: Budget | undefined;
  readonly onDeleteBudget: CreateBudgetMutations["onDeleteBudget"];
  readonly onDone: () => void;
}) {
  if (!input.canMutate) return;
  await deleteExistingBudget(input.existingBudget, input.onDeleteBudget, input.onDone);
}

async function runSave(input: {
  readonly canMutate: boolean;
  readonly draft: CreateBudgetDraftState;
  readonly existingBudget: Budget | undefined;
  readonly onCreateBudget: CreateBudgetMutations["onCreateBudget"];
  readonly onDone: () => void;
  readonly onUpdateBudget: CreateBudgetMutations["onUpdateBudget"];
}) {
  if (!input.canMutate) return;
  const amount = resolveAmount(input.draft.digits);
  if (amount <= 0) return;
  if (input.existingBudget) {
    await saveExistingBudget(input.existingBudget, amount, input.onDone, input.onUpdateBudget);
    return;
  }
  if (!input.draft.category) return;
  await saveNewBudget(input.draft.category, amount, input.onCreateBudget, input.onDone);
}

export function useCreateBudgetSubmit(args: UseCreateBudgetSubmitArgs) {
  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();
  const {
    canMutate,
    draftController,
    existingBudget,
    onCreateBudget,
    onDeleteBudget,
    onDone,
    onUpdateBudget,
  } = args;
  const { draft } = draftController;

  const handleDelete = useCallback(() => {
    void guardedSave(() => runDelete({ canMutate, existingBudget, onDeleteBudget, onDone }));
  }, [canMutate, existingBudget, guardedSave, onDeleteBudget, onDone]);

  const handleSave = useCallback(() => {
    void guardedSave(() =>
      runSave({ canMutate, draft, existingBudget, onCreateBudget, onDone, onUpdateBudget })
    );
  }, [canMutate, draft, existingBudget, guardedSave, onCreateBudget, onDone, onUpdateBudget]);

  return { handleDelete, handleSave, isSaving };
}
