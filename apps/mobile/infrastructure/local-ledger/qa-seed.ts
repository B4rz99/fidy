import type { transfers } from "@/shared/db/schema";
import type { TransactionStorageWriteRow } from "./transaction-storage";
import { insertTransactionStorageRow } from "./transaction-storage";
import type { AnyDb } from "@/shared/db/client";
import { upsertTransferStorageRow } from "./record-transfer";

export function seedLocalLedgerRowsForQa(
  db: AnyDb,
  input: {
    readonly transactions: readonly TransactionStorageWriteRow[];
    readonly transfers: readonly (typeof transfers.$inferInsert)[];
  }
) {
  db.transaction((tx) => {
    input.transactions.forEach((transaction) => {
      insertTransactionStorageRow(tx, transaction);
    });
    input.transfers.forEach((transfer) => {
      upsertTransferStorageRow(tx, transfer);
    });
  });
}
