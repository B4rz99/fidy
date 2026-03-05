import { z } from "zod";
import { categoryIdSchema } from "@/features/transactions/schema";

export const billFrequency = z.enum(["weekly", "biweekly", "monthly", "yearly"]);
export type BillFrequency = z.infer<typeof billFrequency>;

export const billSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  amountCents: z.number().int().positive(),
  frequency: billFrequency,
  categoryId: categoryIdSchema,
  startDate: z.date(),
  isActive: z.boolean(),
});

export type Bill = z.infer<typeof billSchema>;

export const createBillSchema = billSchema.omit({ id: true });
export type CreateBillInput = z.infer<typeof createBillSchema>;
