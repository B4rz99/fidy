import {
  type LlmParsedTransaction,
  llmOutputSchema,
} from "@/features/email-capture/services/llm-parser";
import { stripPii } from "@/features/email-capture/services/parse-email-api";
import { getSupabase } from "@/shared/lib/supabase";

export async function parseNotificationApi(
  notificationText: string
): Promise<LlmParsedTransaction | null> {
  try {
    const stripped = stripPii(notificationText);
    const truncated = stripped.slice(0, 500);

    const { data, error } = await getSupabase().functions.invoke("parse-email", {
      body: { body: truncated, mode: "parse_notification" },
    });

    if (error || !data?.success) {
      console.warn("[parseNotificationApi] edge fn failed:", error?.message ?? "unknown", data);
      return null;
    }

    const result = llmOutputSchema.safeParse(data.data);
    if (!result.success) {
      console.warn("[parseNotificationApi] validation failed:", result.error.issues);
    }
    return result.success ? result.data : null;
  } catch (err) {
    console.warn("[parseNotificationApi] exception:", err);
    return null;
  }
}
