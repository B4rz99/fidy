import type { LlmParsedTransaction } from "@/features/email-capture/llm-parser.public";
import {
  isCaptureNeedsReviewError,
  reviewableParseEmailService,
} from "@/features/email-capture/parse-service.public";

export type NeedsReviewNotificationParse = {
  readonly kind: "needs_review";
  readonly reason?: string;
  readonly confidence?: number | null;
};

export type ParseNotificationApiResult = LlmParsedTransaction | NeedsReviewNotificationParse | null;

export async function parseNotificationApi(
  sanitizedText: string
): Promise<ParseNotificationApiResult> {
  try {
    return await reviewableParseEmailService.parseNotification(sanitizedText);
  } catch (error) {
    if (isCaptureNeedsReviewError(error)) {
      return { kind: "needs_review" };
    }
    throw error;
  }
}
