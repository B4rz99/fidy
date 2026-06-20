import { handleNumpadPress } from "@/features/transactions/display.public";
import { Keyboard } from "@/shared/components/rn";
import type { AddBillFormProps } from "./AddBillForm.types";
import { AddBillFormContent } from "./AddBillFormContent";
import { useAddBillDraft } from "./useAddBillDraft";
import { useAddBillSubmit } from "./useAddBillSubmit";

export function AddBillForm(props: AddBillFormProps) {
  const draftController = useAddBillDraft(props.existingBill);
  const { handleSave, isSaving } = useAddBillSubmit({
    canSubmit: props.canSubmit,
    draftController,
    existingBill: props.existingBill,
    onAddBill: props.onAddBill,
    onDone: props.onDone,
    onUpdateBill: props.onUpdateBill,
  });

  return (
    <AddBillFormContent
      amount={draftController.draft.amount}
      canSubmit={props.canSubmit}
      category={draftController.draft.category}
      frequency={draftController.draft.frequency}
      handleAmountKey={(key) => {
        draftController.setAmount(handleNumpadPress(draftController.draft.amount, key));
      }}
      handleCategoryPress={(category) => {
        Keyboard.dismiss();
        draftController.setCategory(category);
      }}
      handleFrequencyPress={(frequency) => {
        Keyboard.dismiss();
        draftController.setFrequency(frequency);
      }}
      handleSave={handleSave}
      headerTitle={props.headerTitle}
      isEdit={draftController.isEdit}
      isSaving={isSaving}
      name={draftController.draft.name}
      onNameChange={draftController.setName}
      onStartDateChange={draftController.setStartDate}
      startDate={draftController.draft.startDate}
    />
  );
}
