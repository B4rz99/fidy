/* eslint-disable no-restricted-imports */

import {
  insertTransaction,
  softDeleteTransaction,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand } from "./common";

type TransactionSaveCommand = MutationCommandByKind<"transaction.save">;
type TransactionDeleteCommand = MutationCommandByKind<"transaction.delete">;

const applyTransactionSave = (
  db: Parameters<MutationHandlerSubset<"transaction.save">["transaction.save"]>[0],
  command: TransactionSaveCommand
) => {
  const persistTransaction = command.mode === "insert" ? insertTransaction : upsertTransaction;

  persistTransaction(db, command.row);

  return completeCommand(command.afterCommit);
};

const applyTransactionDelete = (
  db: Parameters<MutationHandlerSubset<"transaction.delete">["transaction.delete"]>[0],
  command: TransactionDeleteCommand
) => {
  softDeleteTransaction(db, command.transactionId, command.now);
  return completeCommand(command.afterCommit);
};

export const transactionHandlers: MutationHandlerSubset<"transaction.save" | "transaction.delete"> =
  {
    "transaction.save": applyTransactionSave,
    "transaction.delete": applyTransactionDelete,
  };
