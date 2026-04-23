import { useCallback } from "react";
import { useAsyncGuard } from "@/shared/hooks";
import { parseDigitsToAmount } from "@/shared/lib";
import { requireBillId } from "@/shared/types/assertions";
import type { Bill } from "../../schema";
import type {
  AddBillDraftController,
  AddBillDraftState,
  AddBillMutations,
  UpdateBillInput,
} from "./AddBillForm.types";

type UseAddBillSubmitArgs = AddBillMutations & {
  readonly draftController: AddBillDraftController;
  readonly existingBill: Bill | undefined;
};

function getTrimmedName(draft: AddBillDraftState) {
  return draft.name.trim();
}

function buildUpdateInput(existingBill: Bill, draft: AddBillDraftState): UpdateBillInput | null {
  const amountValue = parseDigitsToAmount(draft.amount);
  if (amountValue <= 0) return null;
  return {
    billId: requireBillId(existingBill.id),
    changes: {
      amount: amountValue,
      categoryId: draft.category,
      frequency: draft.frequency,
      name: getTrimmedName(draft),
      startDate: draft.startDate,
    },
  };
}

function buildAddDraft(draft: AddBillDraftState) {
  return {
    amount: draft.amount,
    categoryId: draft.category,
    frequency: draft.frequency,
    name: getTrimmedName(draft),
    startDate: draft.startDate,
  };
}

async function saveExistingBill(
  existingBill: Bill,
  draft: AddBillDraftState,
  onUpdateBill: AddBillMutations["onUpdateBill"],
  onDone: () => void
) {
  const input = buildUpdateInput(existingBill, draft);
  if (!input) return;
  const success = await onUpdateBill(input);
  if (success) onDone();
}

async function saveNewBill(
  draft: AddBillDraftState,
  onAddBill: AddBillMutations["onAddBill"],
  onDone: () => void
) {
  const success = await onAddBill(buildAddDraft(draft));
  if (success) onDone();
}

export function useAddBillSubmit(args: UseAddBillSubmitArgs) {
  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();
  const { canSubmit, draftController, existingBill, onAddBill, onDone, onUpdateBill } = args;

  const handleSave = useCallback(() => {
    void guardedSave(async () => {
      if (!canSubmit) return;
      if (!getTrimmedName(draftController.draft)) return;
      if (existingBill) {
        await saveExistingBill(existingBill, draftController.draft, onUpdateBill, onDone);
        return;
      }
      await saveNewBill(draftController.draft, onAddBill, onDone);
    });
  }, [
    canSubmit,
    draftController.draft,
    existingBill,
    guardedSave,
    onAddBill,
    onDone,
    onUpdateBill,
  ]);

  return { handleSave, isSaving };
}
