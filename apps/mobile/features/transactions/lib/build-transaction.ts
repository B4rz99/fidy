import { buildDefaultFinancialAccountId } from "@/features/financial-accounts";
import { parseDigitsToAmount, parseIsoDate, toIsoDate, toIsoDateTime } from "@/shared/lib";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import type { AccountAttributionState, StoredTransaction, TransactionType } from "../schema";
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

const OTHER_CATEGORY_ID = getBuiltInCategoryId("other");
const TRANSACTION_SOURCES_WITH_CONFIRMED_DEFAULT = new Set(["manual"]);

function getDefaultAccountAttributionState(source: string | undefined): AccountAttributionState {
  return TRANSACTION_SOURCES_WITH_CONFIRMED_DEFAULT.has(source ?? "manual")
    ? "confirmed"
    : "unresolved";
}

function normalizeAccountAttributionState(
  state: string | undefined,
  source: string | undefined
): AccountAttributionState {
  if (state === "confirmed" || state === "inferred" || state === "unresolved") {
    return state;
  }

  return getDefaultAccountAttributionState(source);
}

export function buildTransaction(
  input: BuildInput,
  userId: UserId,
  id: TransactionId,
  now: Date,
  existing: StoredTransaction | null = null
): { success: true; transaction: StoredTransaction } | { success: false; error: string } {
  const amount = parseDigitsToAmount(input.digits);

  const raw = {
    type: input.type,
    amount: amount as number,
    categoryId: (input.categoryId ?? "other") as string,
    accountId: input.accountId ?? "",
    description: input.description || undefined,
    date: input.date,
  };

  const result = createTransactionSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? "Invalid input",
    };
  }

  return {
    success: true,
    transaction: {
      id,
      userId,
      type: result.data.type,
      amount: result.data.amount as CopAmount,
      categoryId: result.data.categoryId,
      description: result.data.description ?? "",
      date: result.data.date,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: existing?.deletedAt ?? null,
      accountId: result.data.accountId,
      accountAttributionState:
        existing?.accountAttributionState ?? getDefaultAccountAttributionState(existing?.source),
      supersededAt: existing?.supersededAt ?? null,
      source: existing?.source ?? "manual",
    },
  };
}

export function toStoredTransaction(row: TransactionRow): StoredTransaction {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as TransactionType,
    amount: row.amount,
    categoryId: isValidCategoryId(row.categoryId) ? row.categoryId : OTHER_CATEGORY_ID,
    description: row.description ?? "",
    date: parseIsoDate(row.date),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
    accountId: row.accountId ?? buildDefaultFinancialAccountId(row.userId),
    accountAttributionState: normalizeAccountAttributionState(
      row.accountAttributionState,
      row.source
    ),
    supersededAt: row.supersededAt ? new Date(row.supersededAt) : null,
    source: row.source ?? "manual",
  };
}

export function toTransactionRow(tx: StoredTransaction): TransactionRow {
  const source = tx.source ?? "manual";
  return {
    id: tx.id,
    userId: tx.userId,
    type: tx.type,
    amount: tx.amount,
    categoryId: tx.categoryId,
    description: tx.description || null,
    date: toIsoDate(tx.date),
    accountId: tx.accountId,
    accountAttributionState: tx.accountAttributionState,
    supersededAt: tx.supersededAt ? toIsoDateTime(tx.supersededAt) : null,
    createdAt: toIsoDateTime(tx.createdAt),
    updatedAt: toIsoDateTime(tx.updatedAt),
    deletedAt: tx.deletedAt ? toIsoDateTime(tx.deletedAt) : null,
    source,
  };
}
