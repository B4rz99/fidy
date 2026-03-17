import { parseIsoDate, toIsoDate } from "@/shared/lib/format-date";
import type { CreateTransactionInput, StoredTransaction, TransactionType } from "../schema";
import { createTransactionSchema } from "../schema";
import type { CategoryId } from "./categories";
import { isValidCategoryId } from "./categories";
import { digitsToCents } from "./format-amount";
import type { TransactionRow } from "./repository";

type BuildInput = {
  type: TransactionType;
  digits: string;
  categoryId: CategoryId | null;
  description: string;
  date: Date;
};

export function buildTransaction(
  input: BuildInput,
  userId: string,
  id: string,
  now: Date
): { success: true; transaction: StoredTransaction } | { success: false; error: string } {
  const amountCents = digitsToCents(input.digits);

  const raw: CreateTransactionInput = {
    type: input.type,
    amountCents,
    categoryId: input.categoryId ?? "other",
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
      amountCents: result.data.amountCents,
      categoryId: result.data.categoryId,
      description: result.data.description ?? "",
      date: result.data.date,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  };
}

export function toStoredTransaction(row: TransactionRow): StoredTransaction {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as TransactionType,
    amountCents: row.amountCents,
    categoryId: isValidCategoryId(row.categoryId) ? row.categoryId : "other",
    description: row.description ?? "",
    date: parseIsoDate(row.date),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
  };
}

export function toTransactionRow(tx: StoredTransaction): TransactionRow {
  return {
    id: tx.id,
    userId: tx.userId,
    type: tx.type,
    amountCents: tx.amountCents,
    categoryId: tx.categoryId,
    description: tx.description || null,
    date: toIsoDate(tx.date),
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}
