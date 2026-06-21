import type { AnyDb } from "@/shared/db/client";
import type { transfers } from "@/shared/db/schema";
import type { BudgetRow } from "./budget-storage";
import { insertBudget } from "./budget-storage";
import { upsertTransferStorageRow } from "./record-transfer";
import type { TransactionStorageWriteRow } from "./transaction-storage";
import { insertTransactionStorageRow } from "./transaction-storage";

export function seedLocalLedgerRowsForQa(
  db: AnyDb,
  input: {
    readonly budgets: readonly BudgetRow[];
    readonly transactions: readonly TransactionStorageWriteRow[];
    readonly transfers: readonly (typeof transfers.$inferInsert)[];
  }
) {
  db.transaction((tx) => {
    input.budgets.forEach((budget) => {
      insertBudget(tx, budget);
    });
    input.transactions.forEach((transaction) => {
      insertTransactionStorageRow(tx, transaction);
    });
    input.transfers.forEach((transfer) => {
      upsertTransferStorageRow(tx, transfer);
    });
  });
}
