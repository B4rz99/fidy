import type { LlamaContext } from "llama.rn";
import { z } from "zod";
import { CATEGORY_IDS } from "@/features/transactions/lib/categories";
import { buildExtractionPrompt } from "../lib/prompt-template";

const llmOutputSchema = z.object({
  type: z.enum(["expense", "income"]),
  amountCents: z.number().int().positive(),
  categoryId: z.enum(CATEGORY_IDS as unknown as [string, ...string[]]),
  description: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.number().min(0).max(1),
});

export { llmOutputSchema };

export type LlmParsedTransaction = z.infer<typeof llmOutputSchema>;

export async function parseEmailWithLlm(
  emailBody: string,
  context: LlamaContext
): Promise<LlmParsedTransaction | null> {
  const prompt = buildExtractionPrompt(emailBody);

  const response = await context.completion({
    prompt,
    n_predict: 512,
    temperature: 0.1,
  });
  const text = response.text.trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const result = llmOutputSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
