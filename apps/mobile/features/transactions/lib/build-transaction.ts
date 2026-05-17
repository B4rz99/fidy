import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/seed.public";
import { parseDigitsToAmount, parseIsoDate, toIsoDate, toIsoDateTime } from "@/shared/lib";
import { normalizeTransactionSource } from "@/shared/lib/transaction-source";
import type {
  CategoryId,
  FinancialAccountId,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";
import type {
  AccountAttributionState,
  CreateTransactionInput,
  StoredTransaction,
  TransactionType,
} from "../schema";
import { createTransactionSchema } from "../schema";
import { getBuiltInCategoryId, isValidCategoryId } from "./categories";
import type { TransactionRow } from "./repository";

type BuildInput = {
  type: TransactionType;
  digits: string;
  categoryId: CategoryId | null;
  accountId: FinancialAccountId | null;
  description: string;
  date: Date;
};

type BuildTransactionArgs = {
  input: BuildInput;
  userId: UserId;
  id: TransactionId;
  now: Date;
  existing?: StoredTransaction | null;
};

type TransactionBuildResult =
  | { success: true; transaction: StoredTransaction }
  | { success: false; error: string };

type TransactionDraft = {
  type: TransactionType;
  amount: number;
  categoryId: string;
  accountId: FinancialAccountId | "";
  description?: string;
  date: Date;
};

type BuildTransactionContext = {
  validated: CreateTransactionInput;
  userId: UserId;
  id: TransactionId;
  now: Date;
  existing: StoredTransaction | null;
};

const OTHER_CATEGORY_ID = getBuiltInCategoryId("other");
const TRANSACTION_SOURCES_WITH_CONFIRMED_DEFAULT = new Set(["manual"]);

const isAccountAttributionState = (state: string | undefined): state is AccountAttributionState =>
  state === "confirmed" || state === "inferred" || state === "unresolved";

export const getDefaultAccountAttributionState = (
  source: string | undefined | null
): AccountAttributionState =>
  TRANSACTION_SOURCES_WITH_CONFIRMED_DEFAULT.has(source ?? "manual") ? "confirmed" : "unresolved";

const normalizeAccountAttributionState = ({
  state,
  source,
}: {
  state: string | undefined;
  source: string | undefined | null;
}): AccountAttributionState =>
  isAccountAttributionState(state) ? state : getDefaultAccountAttributionState(source);

const toNullableDate = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

const toOptionalDescription = (description: string): string | undefined => description || undefined;

const toNullableDescription = (description: string): string | null => description || null;

const toTransactionDraft = (input: BuildInput): TransactionDraft => ({
  type: input.type,
  amount: parseDigitsToAmount(input.digits) as number,
  categoryId: (input.categoryId ?? OTHER_CATEGORY_ID) as string,
  accountId: input.accountId ?? "",
  description: toOptionalDescription(input.description),
  date: input.date,
});

const parseTransactionDraft = (input: BuildInput) =>
  createTransactionSchema.safeParse(toTransactionDraft(input));

const getBuildError = (error: string): TransactionBuildResult => ({ success: false, error });

const resolveCreatedAt = (existing: StoredTransaction | null, now: Date): Date =>
  existing?.createdAt ?? now;

const resolveVoidedAt = (existing: StoredTransaction | null): Date | null =>
  existing?.voidedAt ?? null;

const resolveSupersededAt = (existing: StoredTransaction | null): Date | null =>
  existing?.supersededAt ?? null;

const resolveSupersededByTransferId = (existing: StoredTransaction | null): TransferId | null =>
  existing?.supersededByTransferId ?? null;

const resolveAccountAttribution = (existing: StoredTransaction | null): AccountAttributionState =>
  existing?.accountAttributionState ?? getDefaultAccountAttributionState(existing?.source);

const mapBuiltTransaction = ({
  validated,
  userId,
  id,
  now,
  existing,
}: BuildTransactionContext): StoredTransaction => ({
  id,
  userId,
  type: validated.type,
  amount: validated.amount,
  categoryId: validated.categoryId,
  description: validated.description ?? "",
  counterpartyName: existing?.counterpartyName ?? "",
  date: validated.date,
  createdAt: resolveCreatedAt(existing, now),
  updatedAt: now,
  voidedAt: resolveVoidedAt(existing),
  accountId: validated.accountId,
  accountAttributionState: resolveAccountAttribution(existing),
  supersededAt: resolveSupersededAt(existing),
  supersededByTransferId: resolveSupersededByTransferId(existing),
  source: normalizeTransactionSource(existing?.source),
});

const getRowAccountId = (row: TransactionRow): FinancialAccountId =>
  row.accountId ?? buildDefaultFinancialAccountId(row.userId);

const getRowCategoryId = (categoryId: string): CategoryId =>
  isValidCategoryId(categoryId) ? categoryId : OTHER_CATEGORY_ID;

const getRowAttributionState = (row: TransactionRow): AccountAttributionState =>
  normalizeAccountAttributionState({
    state: row.accountAttributionState,
    source: row.source,
  });

const serializeNullableDate = (
  value: Date | null | undefined
): ReturnType<typeof toIsoDateTime> | null => (value ? toIsoDateTime(value) : null);

export const buildTransaction = ({
  input,
  userId,
  id,
  now,
  existing = null,
}: BuildTransactionArgs): TransactionBuildResult => {
  const result = parseTransactionDraft(input);
  if (!result.success) {
    return getBuildError(result.error.issues[0]?.message ?? "Invalid input");
  }

  const context: BuildTransactionContext = { validated: result.data, userId, id, now, existing };
  return {
    success: true,
    transaction: mapBuiltTransaction(context),
  };
};

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
  accountId: getRowAccountId(row),
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

export const toTransactionRow = (tx: StoredTransaction): TransactionRow => ({
  id: tx.id,
  userId: tx.userId,
  type: tx.type,
  amount: tx.amount,
  categoryId: tx.categoryId,
  description: toNullableDescription(tx.description),
  counterpartyName: toNullableDescription(tx.counterpartyName ?? ""),
  date: toIsoDate(tx.date),
  accountId: tx.accountId,
  accountAttributionState: tx.accountAttributionState,
  supersededAt: serializeNullableDate(tx.supersededAt),
  supersededByTransferId: tx.supersededByTransferId ?? null,
  createdAt: toIsoDateTime(tx.createdAt),
  updatedAt: toIsoDateTime(tx.updatedAt),
  voidedAt: serializeNullableDate(tx.voidedAt),
  source: normalizeTransactionSource(tx.source),
});
