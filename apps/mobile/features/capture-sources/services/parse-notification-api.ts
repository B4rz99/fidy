import type { LlmParsedTransaction } from "@/features/email-capture/llm-parser.public";
import { liveParseEmailService } from "@/features/email-capture/parse-service.public";

export async function parseNotificationApi(
  sanitizedText: string
): Promise<LlmParsedTransaction | null> {
  return liveParseEmailService.parseNotification(sanitizedText);
}
