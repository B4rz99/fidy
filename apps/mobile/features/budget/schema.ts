import { z } from "zod";
import { categoryIdSchema } from "@/features/transactions";
import type {
  BudgetId,
  CategoryId,
  CopAmount,
  IsoDateTime,
  Month,
  UserId,
} from "@/shared/types/branded";

// Month format: YYYY-MM (01–12 only)
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .transform((s) => s as Month);

export const createBudgetSchema = z.object({
  categoryId: categoryIdSchema,
  amount: z.number().int().positive(),
  month: monthSchema,
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

// Runtime type for a budget stored in DB
export type Budget = {
  readonly id: BudgetId;
  readonly userId: UserId;
  readonly categoryId: CategoryId;
  readonly amount: CopAmount;
  readonly month: Month;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
};
