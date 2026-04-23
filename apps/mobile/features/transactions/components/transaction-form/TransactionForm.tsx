import type { TransactionFormProps } from "./TransactionForm.types";
import { TransactionFormContent } from "./TransactionFormContent";
import { useTransactionFormModel } from "./useTransactionFormModel";

export function TransactionForm(props: TransactionFormProps) {
  const model = useTransactionFormModel({
    accountId: props.accountId,
    accounts: props.accounts,
    date: props.date,
    digits: props.digits,
    onDigitsChange: props.onDigitsChange,
  });

  return <TransactionFormContent {...props} {...model} />;
}
