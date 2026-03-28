import { CATEGORY_IDS } from "@/features/transactions";
import { getSupabase } from "@/shared/db";
import { captureWarning } from "@/shared/lib";
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

type ClassifyResponse = { success: boolean; data?: { categoryId: string } };

export async function classifyMerchantApi(merchant: string): Promise<string> {
  try {
    const response = await getSupabase().functions.invoke<ClassifyResponse>("parse-email", {
      body: { body: merchant, mode: "classify" },
    });
    const data = response.data;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase FunctionsError types are untyped
    const error: { message?: string } | null = response.error;

    if (error != null || !data?.success) {
      captureWarning("classify_merchant_failed", {
        hasError: error != null,
        errorMessage: error?.message ?? "unknown",
      });
      return "other";
    }

    const categoryId = data.data?.categoryId;
    const ids: readonly string[] = CATEGORY_IDS;
    return categoryId != null && ids.includes(categoryId) ? categoryId : "other";
  } catch {
    return "other";
  }
}

export async function parseEmailApi(emailBody: string): Promise<LlmParsedTransaction | null> {
  try {
    const stripped = stripPii(emailBody);
    const truncated = stripped.slice(0, 2000);
    const supabase = getSupabase();

    type ParseEmailResponse = { success: boolean; data: unknown };
    const response = await supabase.functions.invoke<ParseEmailResponse>("parse-email", {
      body: { body: truncated, mode: "full_parse" },
    });
    const data = response.data;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase FunctionsError types are untyped
    const error: { message?: string } | null = response.error;

    if (error != null || !data?.success) {
      captureWarning("parse_email_api_failed", {
        errorMessage: error?.message ?? "unknown",
        hasData: data != null,
      });
      return null;
    }

    const result = llmOutputSchema.safeParse(data.data);
    if (!result.success) {
      captureWarning("parse_email_validation_failed", {
        issueCount: result.error.issues.length,
      });
    }
    return result.success ? result.data : null;
  } catch (err) {
    captureWarning("parse_email_api_exception", {
      errorType: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}
