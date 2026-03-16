import { CATEGORY_IDS } from "@/features/transactions/lib/categories";
import { getSupabase } from "@/shared/db/supabase";
import { type LlmParsedTransaction, llmOutputSchema } from "./llm-parser";

export function stripPii(text: string): string {
  return (
    text
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
      .replace(/\+\d[\d\s-]{8,14}\d/g, "[PHONE]")
      // ID patterns must run before local phone — cedulas starting with 601-608 would otherwise match phones
      .replace(
        /\b(?:C\.?\s?C\.?|T\.?\s?I\.?|C\.?\s?E\.?|[Cc][eé]dula)\s*:?\s*#?\s*\d{6,11}\b/gi,
        "[ID]"
      )
      .replace(/\bNIT\s*:?\s*\d{3}\.?\d{3}\.?\d{3,4}-?\d?\b/gi, "[ID]")
      .replace(
        /(?:(?:No\.?\s*)?Cuenta|Cta\.?)\s*(?:(?:de\s+)?(?:Ahorros|Corriente)\s*)?(?:No\.?\s*)?#?\s{0,3}\d{8,20}/gi,
        "[ACCOUNT]"
      )
      .replace(/(?<!\d)\(?60[1-8]\)?[\s-]?\d{3}[\s-]?\d{4}\b/g, "[PHONE]")
      .replace(/\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g, "[CARD]")
      .replace(/\b\d{15,16}\b/g, "[CARD]")
      .replace(/\d{4}[\s-]*[*Xx]{2,}[\s-]*[*Xx]{2,}[\s-]*\d{4}/g, "[CARD]")
      .replace(/[*Xx]{2,4}[\s.-]*[*Xx]{2,4}[\s.-]*[*Xx]{2,4}[\s.-]*\d{4}/g, "[CARD]")
      .replace(/\*{1,4}\d{4}/g, "[CARD]")
  );
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
    const truncated = stripped.slice(0, 2000);
    const supabase = getSupabase();

    const { data, error } = await supabase.functions.invoke("parse-email", {
      body: { body: truncated, mode: "full_parse" },
    });

    if (error || !data?.success) {
      console.warn("[parseEmailApi] edge fn failed:", error?.message ?? "unknown", data);
      return null;
    }

    const result = llmOutputSchema.safeParse(data.data);
    if (!result.success) {
      console.warn("[parseEmailApi] validation failed:", result.error.issues);
    }
    return result.success ? result.data : null;
  } catch (err) {
    console.warn("[parseEmailApi] exception:", err);
    return null;
  }
}
