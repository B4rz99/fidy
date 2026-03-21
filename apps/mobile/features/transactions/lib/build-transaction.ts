import { parseDigitsToAmount, parseIsoDate, toIsoDate } from "@/shared/lib";
import type {
  CategoryId,
  CopAmount,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import type { StoredTransaction, TransactionType } from "../schema";
import { createTransactionSchema } from "../schema";
import { isValidCategoryId } from "./categories";
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
  userId: UserId,
  id: TransactionId,
  now: Date
): { success: true; transaction: StoredTransaction } | { success: false; error: string } {
  const amount = parseDigitsToAmount(input.digits);

  const raw = {
    type: input.type,
    amount: amount as number,
    categoryId: (input.categoryId ?? "other") as string,
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
    amount: row.amount,
    categoryId: isValidCategoryId(row.categoryId) ? row.categoryId : ("other" as CategoryId),
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
    amount: tx.amount,
    categoryId: tx.categoryId,
    description: tx.description || null,
    date: toIsoDate(tx.date),
    createdAt: tx.createdAt.toISOString() as IsoDateTime,
    updatedAt: tx.updatedAt.toISOString() as IsoDateTime,
  };
}
