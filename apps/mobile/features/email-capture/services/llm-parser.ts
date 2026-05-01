import { z } from "zod";
import { CATEGORY_IDS } from "@/shared/categories";

export const llmOutputSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.number().int().positive(),
  categoryId: z.enum(CATEGORY_IDS as unknown as [string, ...string[]]),
  description: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.number().min(0).max(1),
  fromAccountHint: z.string().optional(),
  toAccountHint: z.string().optional(),
  cardProductHint: z.string().optional(),
  accountTypeHint: z.string().optional(),
  counterpartyHint: z.string().optional(),
});

export type LlmParsedTransaction = z.infer<typeof llmOutputSchema>;
