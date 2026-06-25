import type {
  CloudLedgerCreateTransactionCommand,
  CloudLedgerPendingChange,
  CloudLedgerTransaction,
} from "@/features/cloud-ledger/public";
import { parseIsoDate } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import type { StoredTransaction } from "../schema";

type CloudLedgerStoredTransactionShape = {
  readonly accountId: StoredTransaction["accountId"];
  readonly amount: StoredTransaction["amount"];
  readonly categoryId: StoredTransaction["categoryId"] | null;
  readonly description: string | null;
  readonly id: StoredTransaction["id"];
  readonly timestamp: Date;
  readonly date: StoredTransaction["date"];
  readonly type: StoredTransaction["type"];
};

function toStoredCloudLedgerTransaction(
  userId: UserId,
  transaction: CloudLedgerStoredTransactionShape
): StoredTransaction | null {
  if (transaction.categoryId === null) {
    return null;
  }
  return {
    accountAttributionState: "confirmed",
    accountId: transaction.accountId,
    amount: transaction.amount,
    categoryId: transaction.categoryId,
    counterpartyName: "",
    createdAt: transaction.timestamp,
    date: transaction.date,
    description: transaction.description ?? "",
    id: transaction.id,
    source: "cloud_ledger",
    supersededAt: null,
    supersededByTransferId: null,
    type: transaction.type,
    updatedAt: transaction.timestamp,
    userId,
    voidedAt: null,
  };
}

function asStoredArray(transaction: StoredTransaction | null): readonly StoredTransaction[] {
  return transaction === null ? [] : [transaction];
}

export function cloudLedgerTransactionToStoredTransactions(
  userId: UserId,
  transaction: CloudLedgerTransaction
): readonly StoredTransaction[] {
  const timestamp = new Date(transaction.updatedAt);
  return asStoredArray(
    toStoredCloudLedgerTransaction(userId, {
      ...transaction,
      date: parseIsoDate(transaction.date),
      timestamp,
    })
  );
}

export function pendingCloudLedgerChangeToStoredTransactions(
  userId: UserId,
  change: CloudLedgerPendingChange
): readonly StoredTransaction[] {
  if (change.kind !== "createTransaction") {
    return [];
  }
  const timestamp = new Date(change.createdAt);
  return asStoredArray(
    toStoredCloudLedgerTransaction(userId, {
      ...change.transaction,
      date: parseIsoDate(change.transaction.date),
      timestamp,
    })
  );
}

export function cloudLedgerCreateCommandToStoredTransaction(input: {
  readonly userId: UserId;
  readonly command: CloudLedgerCreateTransactionCommand;
  readonly createdAt: Date;
}): StoredTransaction | null {
  return toStoredCloudLedgerTransaction(input.userId, {
    ...input.command.transaction,
    date: parseIsoDate(input.command.transaction.date),
    timestamp: input.createdAt,
  });
}
