import { z } from "zod";
import { categoryIdSchema, transactionTypeSchema } from "@/features/transactions/schema";
import type { IsoDate } from "@/shared/types/branded";

export const voiceParseResultSchema = z.object({
  type: transactionTypeSchema,
  amount: z.number().int().positive(),
  categoryId: categoryIdSchema,
  description: z.string().trim().max(200),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((s) => s as IsoDate),
});

export type VoiceParseResult = z.infer<typeof voiceParseResultSchema>;
