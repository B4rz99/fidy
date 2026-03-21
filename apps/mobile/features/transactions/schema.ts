import { z } from "zod";
import type { CategoryId, CopAmount, TransactionId, UserId } from "@/shared/types/branded";
import { isValidCategoryId } from "./lib/categories";

export const transactionTypeSchema = z.enum(["expense", "income"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export function makeCategoryIdSchema(isValid: (id: string) => boolean) {
  return z
    .string()
    .refine(isValid, { message: "Invalid category ID" })
    .transform((s) => s as CategoryId);
}

export const categoryIdSchema = makeCategoryIdSchema(isValidCategoryId);

export const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  /** Amount in whole currency units — must be positive */
  amount: z.number().int().positive(),
  categoryId: categoryIdSchema,
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
};
