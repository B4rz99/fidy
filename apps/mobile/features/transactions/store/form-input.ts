import { clampDateToToday } from "@/shared/lib";
import type { TransactionFormInput } from "../lib/mutation-service";
import type { TransactionState } from "./state";

type TransactionFormState = Pick<
  TransactionState,
  "type" | "digits" | "categoryId" | "accountId" | "description" | "date"
>;

export function toTransactionFormInput(state: TransactionFormState): TransactionFormInput {
  return {
    type: state.type,
    digits: state.digits,
    categoryId: state.categoryId,
    accountId: state.accountId,
    description: state.description,
    date: clampDateToToday(state.date),
  };
}
