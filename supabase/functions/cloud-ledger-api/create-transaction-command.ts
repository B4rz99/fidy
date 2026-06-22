import type { CloudLedgerCreateTransactionCommand } from "./model.ts";

export type CreateTransactionCommandReadResult =
  | { readonly kind: "valid"; readonly command: CloudLedgerCreateTransactionCommand }
  | { readonly kind: "invalid_transaction_id" }
  | { readonly kind: "invalid_ledger_reference" }
  | { readonly kind: "invalid_transaction" }
  | { readonly kind: "unsupported_command_version" }
  | { readonly kind: "invalid_command" };

const CLIENT_TRANSACTION_ID_PATTERN = /^txn-[A-Za-z0-9][A-Za-z0-9_-]*$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

export function readCreateTransactionCommand(body: unknown): CreateTransactionCommandReadResult {
  if (body === null || typeof body !== "object") {
    return { kind: "invalid_command" };
  }
  const record = body as Record<string, unknown>;
  const transaction = record.transaction;
  if (record.commandVersion !== 1) {
    return { kind: "unsupported_command_version" };
  }
  if (transaction === null || typeof transaction !== "object") {
    return { kind: "invalid_transaction" };
  }
  const transactionRecord = transaction as Record<string, unknown>;
  const id = readClientTransactionId(transactionRecord.id);
  if (id === null) {
    return { kind: "invalid_transaction_id" };
  }
  const categoryId = readNullableString(transactionRecord, "categoryId");
  const description = readNullableString(transactionRecord, "description");
  const type = readTransactionType(transactionRecord.type);
  const amount = readCopAmount(transactionRecord.amount);
  const currency = readCopCurrency(transactionRecord.currency);
  const accountId = readRequiredString(transactionRecord, "accountId");
  const date = readIsoDate(transactionRecord.date);
  if (categoryId === undefined || accountId === null) {
    return { kind: "invalid_ledger_reference" };
  }
  if (
    type === null ||
    amount === null ||
    currency === null ||
    description === undefined ||
    date === null
  ) {
    return { kind: "invalid_transaction" };
  }

  return {
    kind: "valid",
    command: {
      commandVersion: 1,
      transaction: {
        id,
        type,
        amount,
        currency,
        categoryId,
        accountId,
        description,
        date,
      },
    },
  };
}

function readClientTransactionId(value: unknown): string | null {
  return typeof value === "string" && CLIENT_TRANSACTION_ID_PATTERN.test(value) ? value : null;
}

function readTransactionType(value: unknown): "income" | "expense" | null {
  return value === "income" || value === "expense" ? value : null;
}

function readCopCurrency(value: unknown): "COP" | null {
  return value === "COP" ? "COP" : null;
}

function readCopAmount(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= POSTGRES_INTEGER_MAX
    ? value
    : null;
}

function readIsoDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : null;
}

function readNullableString(body: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in body)) {
    return null;
  }
  const value = body[key];
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "string" ? value : undefined;
}

function readRequiredString(body: unknown, key: string): string | null {
  if (body === null || typeof body !== "object" || !(key in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
