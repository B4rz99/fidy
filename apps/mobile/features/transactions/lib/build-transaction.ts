import { parseIsoDate } from "@/shared/lib/format-date";
import { normalizeTransactionSource } from "@/shared/lib/transaction-source";
import { requireCategoryId } from "@/shared/types/assertions";
import type { CategoryId } from "@/shared/types/branded";
import type { AccountAttributionState, StoredTransaction, TransactionType } from "../schema";
import type { TransactionRow } from "./repository";

const TRANSACTION_SOURCES_WITH_CONFIRMED_DEFAULT = new Set(["manual", "cloud_ledger"]);

const isAccountAttributionState = (state: string): state is AccountAttributionState =>
  state === "confirmed" || state === "inferred" || state === "unresolved";

export const getDefaultAccountAttributionState = (
  source: string | undefined | null
): AccountAttributionState =>
  TRANSACTION_SOURCES_WITH_CONFIRMED_DEFAULT.has(source ?? "manual") ? "confirmed" : "unresolved";

const normalizeAccountAttributionState = (state: string): AccountAttributionState => {
  if (!isAccountAttributionState(state)) {
    throw new Error(`Unsupported account attribution state: ${state}`);
  }
  return state;
};

const toNullableDate = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

const getRowCategoryId = (categoryId: string): CategoryId => requireCategoryId(categoryId);

const getRowAttributionState = (row: TransactionRow): AccountAttributionState =>
  normalizeAccountAttributionState(row.accountAttributionState);

const toStoredTransactionIdentity = (row: TransactionRow) => ({
  id: row.id,
  userId: row.userId,
  type: row.type as TransactionType,
  amount: row.amount,
  categoryId: getRowCategoryId(row.categoryId),
  description: row.description ?? "",
  counterpartyName: row.counterpartyName ?? "",
});

const toStoredTransactionDates = (row: TransactionRow) => ({
  date: parseIsoDate(row.date),
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
  voidedAt: toNullableDate(row.voidedAt),
});

const toStoredTransactionMetadata = (row: TransactionRow) => ({
  accountId: row.accountId,
  accountAttributionState: getRowAttributionState(row),
  supersededAt: toNullableDate(row.supersededAt),
  supersededByTransferId: row.supersededByTransferId ?? null,
  source: normalizeTransactionSource(row.source),
});

export const toStoredTransaction = (row: TransactionRow): StoredTransaction => ({
  ...toStoredTransactionIdentity(row),
  ...toStoredTransactionDates(row),
  ...toStoredTransactionMetadata(row),
});
