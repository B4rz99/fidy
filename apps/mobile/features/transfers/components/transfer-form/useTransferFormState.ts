import { useRef, useState } from "react";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { StoredTransaction } from "@/features/transactions/query.public";
import type { TransferSide } from "@/features/transfers/build.public";
import type { AccountBalanceMap, PickerTarget } from "./TransferForm.types";

function useTransferFormDraftState() {
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState("");
  const [digits, setDigits] = useState("");
  const [fromSide, setFromSide] = useState<TransferSide | null>(null);
  const [toSide, setToSide] = useState<TransferSide | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [lastEditedSide, setLastEditedSide] = useState<PickerTarget>("to");
  const [showDatePicker, setShowDatePicker] = useState(false);

  return {
    date,
    description,
    digits,
    fromSide,
    lastEditedSide,
    pickerTarget,
    setDate,
    setDescription,
    setDigits,
    setFromSide,
    setLastEditedSide,
    setPickerTarget,
    setShowDatePicker,
    setToSide,
    showDatePicker,
    toSide,
  };
}

function useTransferFormDataState() {
  const [accounts, setAccounts] = useState<readonly FinancialAccountRow[]>([]);
  const [balances, setBalances] = useState<AccountBalanceMap>({});
  const [sourceTransaction, setSourceTransaction] = useState<StoredTransaction | null>(null);

  return { accounts, balances, setAccounts, setBalances, setSourceTransaction, sourceTransaction };
}

function useTransferFormFields() {
  return { ...useTransferFormDataState(), ...useTransferFormDraftState() };
}

function useTransferFormRefs() {
  const hydratedTransactionIdRef = useRef<string | null>(null);
  const appliedInitialDraftRef = useRef(false);

  return { appliedInitialDraftRef, hydratedTransactionIdRef };
}

export type TransferFormState = ReturnType<typeof useTransferFormFields> &
  ReturnType<typeof useTransferFormRefs>;

export function useTransferFormState(): TransferFormState {
  return { ...useTransferFormFields(), ...useTransferFormRefs() };
}
