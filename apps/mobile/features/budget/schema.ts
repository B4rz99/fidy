import { z } from "zod";
import { categoryIdSchema } from "@/features/transactions";

// Month format: YYYY-MM (01–12 only)
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const createBudgetSchema = z.object({
  categoryId: categoryIdSchema,
  amount: z.number().int().positive(),
  month: monthSchema,
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

// Runtime type for a budget stored in DB
export type Budget = {
  readonly id: string;
  readonly userId: string;
  readonly categoryId: string;
  readonly amount: number;
  readonly month: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
};
