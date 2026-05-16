import { z } from "zod";
import { categoryIdSchema } from "@/shared/categories";
import type { NormalizedTransactionSource } from "@/shared/lib/transaction-source";
import { requireCopAmount, requireFinancialAccountId } from "@/shared/types/assertions";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";

export const transactionTypeSchema = z.enum(["expense", "income"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const accountAttributionStateSchema = z.enum(["confirmed", "inferred", "unresolved"]);
export type AccountAttributionState = z.infer<typeof accountAttributionStateSchema>;

export const financialAccountIdSchema = z
  .string()
  .trim()
  .min(1, "Account is required")
  .transform((value, ctx) => {
    try {
      return requireFinancialAccountId(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Account is required" });
      return z.NEVER;
    }
  });

export { categoryIdSchema, makeCategoryIdSchema } from "@/shared/categories";

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
  readonly counterpartyName?: string;
  readonly date: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly voidedAt?: Date | null;
  readonly accountId: FinancialAccountId;
  readonly accountAttributionState: AccountAttributionState;
  readonly supersededAt?: Date | null;
  readonly supersededByTransferId?: TransferId | null;
  readonly source?: NormalizedTransactionSource;
};
