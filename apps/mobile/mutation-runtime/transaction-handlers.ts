/* eslint-disable no-restricted-imports */

import {
  insertTransaction,
  softDeleteTransaction,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand, queueSyncChange } from "./common";

type TransactionSaveCommand = MutationCommandByKind<"transaction.save">;
type TransactionDeleteCommand = MutationCommandByKind<"transaction.delete">;

const applyTransactionSave = (
  db: Parameters<MutationHandlerSubset<"transaction.save">["transaction.save"]>[0],
  command: TransactionSaveCommand
) => {
  const persistTransaction = command.mode === "insert" ? insertTransaction : upsertTransaction;
  const operation = command.mode === "insert" ? "insert" : "update";

  persistTransaction(db, command.row);
  queueSyncChange(db, {
    tableName: "transactions",
    rowId: command.row.id,
    operation,
    createdAt: command.row.updatedAt,
  });

  return completeCommand(command.afterCommit);
};

const applyTransactionDelete = (
  db: Parameters<MutationHandlerSubset<"transaction.delete">["transaction.delete"]>[0],
  command: TransactionDeleteCommand
) => {
  softDeleteTransaction(db, command.transactionId, command.now);
  queueSyncChange(db, {
    tableName: "transactions",
    rowId: command.transactionId,
    operation: "delete",
    createdAt: command.now,
  });
  return completeCommand(command.afterCommit);
};

export const transactionHandlers: MutationHandlerSubset<"transaction.save" | "transaction.delete"> =
  {
    "transaction.save": applyTransactionSave,
    "transaction.delete": applyTransactionDelete,
  };
