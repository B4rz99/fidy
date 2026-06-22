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

export type RetryNotificationParse = {
  readonly kind: "retry";
};

export type ParseNotificationApiResult =
  | LlmParsedTransaction
  | NeedsReviewNotificationParse
  | RetryNotificationParse
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
    return { kind: "retry" };
  }
}
