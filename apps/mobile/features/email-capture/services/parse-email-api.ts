import { CATEGORY_IDS } from "@/features/transactions/lib/categories";
import { getSupabase } from "@/shared/lib/supabase";
import { type LlmParsedTransaction, llmOutputSchema } from "./llm-parser";

export function stripPii(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
    .replace(/\+?\d[\d\s-]{8,14}\d/g, "[PHONE]")
    .replace(/\*{1,4}\d{4}/g, "[CARD]");
}

export async function classifyMerchantApi(merchant: string): Promise<string> {
  try {
    const { data, error } = await getSupabase().functions.invoke("parse-email", {
      body: { body: merchant, mode: "classify" },
    });

    if (error || !data?.success) return "other";

    const categoryId = data.data?.categoryId;
    return CATEGORY_IDS.includes(categoryId) ? categoryId : "other";
  } catch {
    return "other";
  }
}

export async function parseEmailApi(emailBody: string): Promise<LlmParsedTransaction | null> {
  try {
    const stripped = stripPii(emailBody);

    const { data, error } = await getSupabase().functions.invoke("parse-email", {
      body: { body: stripped, mode: "full_parse" },
    });

    if (error || !data?.success) return null;

    const result = llmOutputSchema.safeParse(data.data);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
