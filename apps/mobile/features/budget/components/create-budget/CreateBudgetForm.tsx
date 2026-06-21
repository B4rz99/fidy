import { useCallback } from "react";
import { handleNumpadPress } from "@/features/transactions/display.public";
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
  const { draft, isEdit, setCategory, setDigits } = draftController;
  const handleKey = useCallback(
    (key: string) => {
      setDigits((currentDigits) => handleNumpadPress(currentDigits, key));
    },
    [setDigits]
  );

  return (
    <CreateBudgetFormContent
      autoSuggestions={props.autoSuggestions}
      canMutate={props.canMutate}
      category={draft.category}
      digits={draft.digits}
      existingCategoryIds={props.existingCategoryIds}
      handleDelete={handleDelete}
      handleKey={handleKey}
      handleSave={handleSave}
      headerTitle={props.headerTitle}
      isEdit={isEdit}
      isSaving={isSaving}
      setCategory={setCategory}
    />
  );
}
