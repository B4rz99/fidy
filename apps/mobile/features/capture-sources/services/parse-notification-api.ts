import {
  type LlmParsedTransaction,
  llmOutputSchema,
} from "@/features/email-capture/services/llm-parser";
import { getSupabase } from "@/shared/db";
import { captureWarning } from "@/shared/lib";

type ParseEmailResponse = { success: boolean; data: unknown };

export async function parseNotificationApi(
  sanitizedText: string
): Promise<LlmParsedTransaction | null> {
  try {
    const response = await getSupabase().functions.invoke<ParseEmailResponse>("parse-email", {
      body: { body: sanitizedText, mode: "parse_notification" },
    });
    const data = response.data;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase FunctionsError types are untyped
    const error: { message?: string } | null = response.error;

    if (error != null || !data?.success) {
      captureWarning("parse_notification_api_failed", {
        errorMessage: error?.message ?? "unknown",
        hasData: data != null,
      });
      return null;
    }

    const result = llmOutputSchema.safeParse(data.data);
    if (!result.success) {
      captureWarning("parse_notification_validation_failed", {
        issueCount: result.error.issues.length,
      });
    }
    return result.success ? result.data : null;
  } catch (err) {
    captureWarning("parse_notification_api_exception", {
      errorType: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}
