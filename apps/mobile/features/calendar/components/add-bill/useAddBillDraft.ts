import { useCallback, useState } from "react";
import { getBuiltInCategoryId } from "@/shared/categories";
import type { Bill } from "../../schema";
import type { AddBillDraftController, AddBillDraftState } from "./AddBillForm.types";

const DEFAULT_BILL_CATEGORY_ID = getBuiltInCategoryId("services");

function resolveInitialAmount(existingBill: Bill | undefined) {
  return existingBill ? String(existingBill.amount) : "";
}

function resolveInitialCategory(existingBill: Bill | undefined) {
  const categoryId = existingBill?.categoryId;
  if (!categoryId) return DEFAULT_BILL_CATEGORY_ID;
  return categoryId;
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

export function useAddBillDraft(existingBill: Bill | undefined): AddBillDraftController {
  const [draft, setDraft] = useState(() => resolveInitialDraft(existingBill));

  return {
    draft,
    isEdit: Boolean(existingBill),
    setAmount: useCallback((amount) => {
      setDraft((current) => ({ ...current, amount }));
    }, []),
    setCategory: useCallback((category) => {
      setDraft((current) => ({ ...current, category }));
    }, []),
    setFrequency: useCallback((frequency) => {
      setDraft((current) => ({ ...current, frequency }));
    }, []),
    setName: useCallback((name) => {
      setDraft((current) => ({ ...current, name }));
    }, []),
    setStartDate: useCallback((startDate) => {
      setDraft((current) => ({ ...current, startDate }));
    }, []),
  };
}
