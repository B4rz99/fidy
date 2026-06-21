import { useState } from "react";
import { useTransferEntry } from "@/features/transfers/ui.public";
import type { TransactionFormMode, TransactionFormProps } from "./TransactionForm.types";
import { TransactionFormContent } from "./TransactionFormContent";
import { TransactionAccountPickerDialog } from "../TransactionAccountPickerDialog";
import { TransactionDatePickerDialog } from "../TransactionDatePickerDialog";
import { useTransactionFormModel } from "./useTransactionFormModel";

type TransactionFormPicker = "account" | "date" | null;

export function TransactionForm(props: TransactionFormProps) {
  const [picker, setPicker] = useState<TransactionFormPicker>(null);
  const [isTransferMode, setIsTransferMode] = useState(false);
  const mode: TransactionFormMode = isTransferMode ? "transfer" : props.type;
  const transferEntry = useTransferEntry({
    digits: props.digits,
    enabled: mode === "transfer",
    setDigits: props.onDigitsChange,
  });
  const model = useTransactionFormModel({
    accountId: props.accountId,
    accounts: props.accounts,
    date: props.date,
    digits: props.digits,
    onDigitsChange: props.onDigitsChange,
  });
  const handleModeChange = (nextMode: TransactionFormMode) => {
    if (nextMode === "transfer") {
      setIsTransferMode(true);
      return;
    }

    setIsTransferMode(false);
    props.onTypeChange(nextMode);
  };

  return (
    <>
      <TransactionFormContent
        {...props}
        {...model}
        mode={mode}
        transferEntry={transferEntry}
        onAccountPress={() => setPicker("account")}
        onDatePress={() => setPicker("date")}
        handleModeChange={handleModeChange}
      />
      <TransactionAccountPickerDialog
        accountId={props.accountId}
        accounts={props.accounts}
        visible={picker === "account"}
        onClose={() => setPicker(null)}
        onSelect={(accountId) => {
          props.onAccountChange(accountId);
          setPicker(null);
        }}
      />
      <TransactionDatePickerDialog
        date={props.date}
        visible={picker === "date"}
        onChange={props.onDateChange}
        onClose={() => setPicker(null)}
      />
    </>
  );
}
