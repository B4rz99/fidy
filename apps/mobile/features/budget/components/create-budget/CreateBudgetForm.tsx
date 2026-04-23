import { useCallback } from "react";
import { handleNumpadPress } from "@/features/transactions";
import type { CreateBudgetFormProps } from "./CreateBudget.types";
import { CreateBudgetFormContent } from "./CreateBudgetFormContent";
import { useCreateBudgetDraft } from "./useCreateBudgetDraft";
import { useCreateBudgetSubmit } from "./useCreateBudgetSubmit";

export function CreateBudgetForm(props: CreateBudgetFormProps) {
  const draftController = useCreateBudgetDraft(props.existingBudget);
  const { handleDelete, handleSave, isSaving } = useCreateBudgetSubmit({
    canMutate: props.canMutate,
    draftController,
    existingBudget: props.existingBudget,
    onCreateBudget: props.onCreateBudget,
    onDeleteBudget: props.onDeleteBudget,
    onDone: props.onDone,
    onUpdateBudget: props.onUpdateBudget,
  });
  const handleKey = useCallback(
    (key: string) => {
      draftController.setDigits(handleNumpadPress(draftController.draft.digits, key));
    },
    [draftController]
  );

  return (
    <CreateBudgetFormContent
      autoSuggestions={props.autoSuggestions}
      canMutate={props.canMutate}
      category={draftController.draft.category}
      digits={draftController.draft.digits}
      existingCategoryIds={props.existingCategoryIds}
      handleDelete={handleDelete}
      handleKey={handleKey}
      handleSave={handleSave}
      isEdit={draftController.isEdit}
      isSaving={isSaving}
      setCategory={draftController.setCategory}
    />
  );
}
