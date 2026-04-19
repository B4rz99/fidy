import { z } from "zod";
import {
  requireCategoryId,
  requireCopAmount,
  requireFinancialAccountId,
} from "@/shared/types/assertions";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import { isValidCategoryId } from "./lib/categories";

export const transactionTypeSchema = z.enum(["expense", "income"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const accountAttributionStateSchema = z.enum(["confirmed", "inferred", "unresolved"]);
export type AccountAttributionState = z.infer<typeof accountAttributionStateSchema>;

export const financialAccountIdSchema = z
  .string()
  .min(1, "Account is required")
  .transform((value) => requireFinancialAccountId(value));

export function makeCategoryIdSchema(isValid: (id: string) => boolean) {
  return z
    .string()
    .refine(isValid, { message: "Invalid category ID" })
    .transform((value) => requireCategoryId(value));
}

export const categoryIdSchema = makeCategoryIdSchema(isValidCategoryId);

export const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  /** Amount in whole currency units — must be positive */
  amount: z
    .number()
    .int()
    .positive()
    .transform((value) => requireCopAmount(value)),
  categoryId: categoryIdSchema,
  accountId: financialAccountIdSchema,
  description: z.string().trim().max(200).optional(),
  date: z.date(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export type StoredTransaction = {
  readonly id: TransactionId;
  readonly userId: UserId;
  readonly type: TransactionType;
  readonly amount: CopAmount;
  readonly categoryId: CategoryId;
  readonly description: string;
  readonly date: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly accountId: FinancialAccountId;
  readonly accountAttributionState: AccountAttributionState;
  readonly supersededAt?: Date | null;
  readonly source?: string;
};
