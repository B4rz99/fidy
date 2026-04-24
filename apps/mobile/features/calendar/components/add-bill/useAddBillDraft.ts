import type { Dispatch, SetStateAction } from "react";
import { useCallback, useRef, useState } from "react";
import { getBuiltInCategoryId, isValidCategoryId } from "@/shared/categories";
import type { TextInput } from "@/shared/components/rn";
import type { Bill } from "../../schema";
import type { AddBillDraftController, AddBillDraftState } from "./AddBillForm.types";

const DEFAULT_BILL_CATEGORY_ID = getBuiltInCategoryId("services");

function resolveInitialAmount(existingBill: Bill | undefined) {
  return existingBill ? String(existingBill.amount) : "";
}

function resolveInitialCategory(existingBill: Bill | undefined) {
  const categoryId = existingBill?.categoryId;
  if (!categoryId) return DEFAULT_BILL_CATEGORY_ID;
  return isValidCategoryId(categoryId) ? categoryId : DEFAULT_BILL_CATEGORY_ID;
}

function resolveInitialFrequency(existingBill: Bill | undefined) {
  return existingBill?.frequency ?? "monthly";
}

function resolveInitialName(existingBill: Bill | undefined) {
  return existingBill?.name ?? "";
}

function resolveInitialStartDate(existingBill: Bill | undefined) {
  return existingBill?.startDate ?? new Date();
}

function resolveInitialDraft(existingBill: Bill | undefined): AddBillDraftState {
  return {
    amount: resolveInitialAmount(existingBill),
    category: resolveInitialCategory(existingBill),
    frequency: resolveInitialFrequency(existingBill),
    name: resolveInitialName(existingBill),
    startDate: resolveInitialStartDate(existingBill),
  };
}

function updateDraft<Field extends keyof AddBillDraftState>(
  setDraft: Dispatch<SetStateAction<AddBillDraftState>>,
  field: Field
) {
  return (value: AddBillDraftState[Field]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };
}

export function useAddBillDraft(existingBill: Bill | undefined): AddBillDraftController {
  const amountRef = useRef<TextInput>(null);
  const [draft, setDraft] = useState(() => resolveInitialDraft(existingBill));

  return {
    amountRef,
    draft,
    isEdit: Boolean(existingBill),
    setAmount: useCallback(updateDraft(setDraft, "amount"), []),
    setCategory: useCallback(updateDraft(setDraft, "category"), []),
    setFrequency: useCallback(updateDraft(setDraft, "frequency"), []),
    setName: useCallback(updateDraft(setDraft, "name"), []),
    setStartDate: useCallback(updateDraft(setDraft, "startDate"), []),
  };
}
