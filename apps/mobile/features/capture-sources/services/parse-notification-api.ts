import {
  type LlmParsedTransaction,
  llmOutputSchema,
} from "@/features/email-capture/services/llm-parser";
import { getSupabase } from "@/shared/db";
import { captureWarning } from "@/shared/lib";

export async function parseNotificationApi(
  sanitizedText: string
): Promise<LlmParsedTransaction | null> {
  try {
    const { data, error } = await getSupabase().functions.invoke("parse-email", {
      body: { body: sanitizedText, mode: "parse_notification" },
    });

    if (error || !data?.success) {
      captureWarning("parse_notification_api_failed", {
        errorMessage: error?.message ?? "unknown",
        hasData: !!data,
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
