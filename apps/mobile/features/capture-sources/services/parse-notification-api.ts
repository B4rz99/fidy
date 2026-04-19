import type { LlmParsedTransaction } from "@/features/email-capture/llm-parser.public";
import { liveParseEmailService } from "@/features/email-capture/services/parse-email-service";

export async function parseNotificationApi(
  sanitizedText: string
): Promise<LlmParsedTransaction | null> {
  return liveParseEmailService.parseNotification(sanitizedText);
}
