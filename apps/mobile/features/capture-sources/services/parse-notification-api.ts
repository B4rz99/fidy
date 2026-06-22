import type { LlmParsedTransaction } from "@/features/email-capture/llm-parser.public";
import {
  isCaptureNeedsReviewError,
  retryableParseEmailService,
} from "@/features/email-capture/parse-service.public";

export type NeedsReviewNotificationParse = {
  readonly kind: "needs_review";
  readonly reason?: string;
  readonly confidence?: number | null;
};

export type AiUnavailableNotificationParse = {
  readonly kind: "ai_unavailable";
};

export type ParseNotificationApiResult =
  | LlmParsedTransaction
  | NeedsReviewNotificationParse
  | AiUnavailableNotificationParse
  | null;

export async function parseNotificationApi(
  sanitizedText: string
): Promise<ParseNotificationApiResult> {
  try {
    return await retryableParseEmailService.parseNotification(sanitizedText);
  } catch (error) {
    if (isCaptureNeedsReviewError(error)) {
      return { kind: "needs_review" };
    }
    return { kind: "ai_unavailable" };
  }
}
