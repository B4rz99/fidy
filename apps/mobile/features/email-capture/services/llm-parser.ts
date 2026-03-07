import { z } from "zod";
import { CATEGORY_IDS } from "@/features/transactions/lib/categories";

export const llmOutputSchema = z.object({
  type: z.enum(["expense", "income"]),
  amountCents: z.number().int().positive(),
  categoryId: z.enum(CATEGORY_IDS as unknown as [string, ...string[]]),
  description: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.number().min(0).max(1),
});

export type LlmParsedTransaction = z.infer<typeof llmOutputSchema>;
