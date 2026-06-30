import {
  requireCategoryId,
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerChangeId,
  requireTransactionId,
} from "@/shared/types/assertions";
import type { IsoDateTime, LedgerChangeId, TransactionId } from "@/shared/types/branded";
import type { CloudLedgerApplyPendingChangesCommand } from "./api-client";
import {
  withTransactionProjection,
  type CloudLedgerCache,
  type CloudLedgerCreateTransactionCommand,
  type CloudLedgerTransaction,
} from "./cache";

export type CloudLedgerPendingCreateTransaction = {
  readonly id: LedgerChangeId;
  readonly kind: "createTransaction";
  readonly commandVersion: 1;
  readonly transaction: CloudLedgerCreateTransactionCommand["transaction"];
  readonly createdAt: IsoDateTime;
};

export type CloudLedgerPendingAmendTransaction = {
  readonly id: LedgerChangeId;
  readonly kind: "amendTransaction";
  readonly commandVersion: 1;
  readonly transaction: CloudLedgerCreateTransactionCommand["transaction"];
  readonly expectedVersion: number;
  readonly createdAt: IsoDateTime;
};

export type CloudLedgerPendingDeleteTransaction = {
  readonly id: LedgerChangeId;
  readonly kind: "deleteTransaction";
  readonly commandVersion: 1;
  readonly transactionId: TransactionId;
  readonly expectedVersion: number;
  readonly createdAt: IsoDateTime;
};

export type CloudLedgerPendingChange =
  | CloudLedgerPendingAmendTransaction
  | CloudLedgerPendingCreateTransaction
  | CloudLedgerPendingDeleteTransaction;

export function applyPendingLedgerChanges(
  cache: CloudLedgerCache,
  changes: readonly CloudLedgerPendingChange[]
): CloudLedgerCache {
  const optimisticTransactions = changes.reduce(applyPendingLedgerChange, cache.transactions);
  return {
    ...cache,
    ...withTransactionProjection(optimisticTransactions),
  };
}

export function toPendingChangeCommand(
  change: CloudLedgerPendingChange
): CloudLedgerApplyPendingChangesCommand["changes"][number] {
  const base = {
    id: change.id,
    commandVersion: change.commandVersion,
    idempotencyKey: change.id,
    dependencies: [],
    expectedVersions: expectedVersionsForPendingChange(change),
    clientTimestamp: change.createdAt,
  } as const;
  if (change.kind === "createTransaction") {
    return { ...base, kind: "createTransaction", transaction: change.transaction };
  }
  return change.kind === "amendTransaction"
    ? { ...base, kind: "amendTransaction", transaction: change.transaction }
    : { ...base, kind: "deleteTransaction", transactionId: change.transactionId };
}

export function toTransactionCommandPayload(
  transaction: CloudLedgerTransaction
): CloudLedgerCreateTransactionCommand["transaction"] {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    description: transaction.description,
    date: transaction.date,
  };
}

export function parsePendingChange(value: unknown): CloudLedgerPendingChange {
  const record = requireRecord(value, "pending change");
  if (record.commandVersion !== 1) {
    throw new Error("pending change command version must be supported");
  }
  if (record.kind === "createTransaction") {
    return {
      id: requireLedgerChangeId(requireString(record.id, "id")),
      kind: "createTransaction",
      commandVersion: 1,
      transaction: parseCreateTransaction(record.transaction),
      createdAt: requireIsoDateTime(requireString(record.createdAt, "createdAt")),
    };
  }
  if (record.kind === "amendTransaction") {
    return {
      id: requireLedgerChangeId(requireString(record.id, "id")),
      kind: "amendTransaction",
      commandVersion: 1,
      transaction: parseCreateTransaction(record.transaction),
      expectedVersion: requirePositiveInteger(record.expectedVersion, "expectedVersion"),
      createdAt: requireIsoDateTime(requireString(record.createdAt, "createdAt")),
    };
  }
  if (record.kind === "deleteTransaction") {
    return {
      id: requireLedgerChangeId(requireString(record.id, "id")),
      kind: "deleteTransaction",
      commandVersion: 1,
      transactionId: requireTransactionId(requireString(record.transactionId, "transactionId")),
      expectedVersion: requirePositiveInteger(record.expectedVersion, "expectedVersion"),
      createdAt: requireIsoDateTime(requireString(record.createdAt, "createdAt")),
    };
  }
  throw new Error("pending change command kind must be supported");
}

function expectedVersionsForPendingChange(change: CloudLedgerPendingChange): readonly {
  readonly recordType: "transaction";
  readonly recordId: TransactionId;
  readonly version: number;
}[] {
  return change.kind === "createTransaction"
    ? []
    : [
        {
          recordType: "transaction",
          recordId:
            change.kind === "deleteTransaction" ? change.transactionId : change.transaction.id,
          version: change.expectedVersion,
        },
      ];
}

function applyPendingLedgerChange(
  transactions: readonly CloudLedgerTransaction[],
  change: CloudLedgerPendingChange
): readonly CloudLedgerTransaction[] {
  return change.kind === "deleteTransaction"
    ? transactions.filter((transaction) => transaction.id !== change.transactionId)
    : upsertTransactions(transactions, [toOptimisticTransaction(change)]);
}

function toOptimisticTransaction(
  change: CloudLedgerPendingCreateTransaction | CloudLedgerPendingAmendTransaction
): CloudLedgerTransaction {
  return {
    ...change.transaction,
    version: change.kind === "createTransaction" ? 1 : change.expectedVersion + 1,
    updatedAt: change.createdAt,
  };
}

function upsertTransactions(
  existing: readonly CloudLedgerTransaction[],
  incoming: readonly CloudLedgerTransaction[]
): readonly CloudLedgerTransaction[] {
  return [
    ...new Map(
      [...existing, ...incoming].map((transaction) => [transaction.id, transaction])
    ).values(),
  ];
}

function parseCreateTransaction(
  value: unknown
): CloudLedgerCreateTransactionCommand["transaction"] {
  const record = requireRecord(value, "transaction");
  return {
    id: requireTransactionId(requireString(record.id, "transaction.id")),
    type: requireTransactionType(record.type),
    amount: requireCopAmount(requireNumber(record.amount, "transaction.amount")),
    currency: requireCopCurrency(record.currency),
    categoryId: parseCategoryId(record.categoryId),
    accountId: requireFinancialAccountId(requireString(record.accountId, "transaction.accountId")),
    description: parseDescription(record.description),
    date: requireIsoDate(requireString(record.date, "transaction.date")),
  };
}

function parseCategoryId(value: unknown) {
  return value === null ? null : requireCategoryId(requireString(value, "transaction.categoryId"));
}

function parseDescription(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  return requireString(value, "transaction.description");
}

function requireTransactionType(value: unknown): "income" | "expense" {
  if (value === "income" || value === "expense") {
    return value;
  }
  throw new Error("transaction.type must be income or expense");
}

function requireCopCurrency(value: unknown): "COP" {
  if (value === "COP") {
    return "COP";
  }
  throw new Error("transaction.currency must be COP");
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${label} must be an object`);
}

function requireString(value: unknown, label: string): string {
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`${label} must be a string`);
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value === "number") {
    return value;
  }
  throw new Error(`${label} must be a number`);
}

function requirePositiveInteger(value: unknown, label: string): number {
  const number = requireNumber(value, label);
  if (Number.isInteger(number) && number > 0) {
    return number;
  }
  throw new Error(`${label} must be a positive integer`);
}
