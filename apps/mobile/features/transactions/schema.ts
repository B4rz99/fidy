import { z } from "zod";
import { CATEGORIES, type CategoryId } from "./lib/categories";

export const transactionTypeSchema = z.enum(["expense", "income"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

const categoryIds = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const categoryIdSchema = z.enum(categoryIds);

export const createTransactionSchema = z.object({
  type: transactionTypeSchema,
  /** Amount in cents — must be positive */
  amountCents: z.number().int().positive(),
  categoryId: categoryIdSchema,
  description: z.string().trim().max(200).optional(),
  date: z.date(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export type StoredTransaction = {
  readonly id: string;
  readonly userId: string;
  readonly type: TransactionType;
  readonly amountCents: number;
  readonly categoryId: CategoryId;
  readonly description: string;
  readonly date: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
};
