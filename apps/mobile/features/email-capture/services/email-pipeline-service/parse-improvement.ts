import { getTransactionSource } from "./shared";
import type { EmailBatchContext, RawEmail } from "./types";
import { appendEmailParseImprovementRequest } from "./shared";

const buildEmailParseImprovementRawText = (email: RawEmail): string =>
  [email.subject, email.body].filter((part) => part.trim().length > 0).join("\n\n");

export function appendFailedEmailParseImprovementRequest(
  context: EmailBatchContext,
  email: RawEmail
) {
  appendEmailParseImprovementRequest({
    result: context.result,
    request: {
      rawText: buildEmailParseImprovementRawText(email),
      source: getTransactionSource(email.provider),
      status: "failed",
      confidence: null,
      parseMethod: "llm",
    },
  });
}

export function appendNeedsReviewEmailParseImprovementRequest(
  context: EmailBatchContext,
  email: RawEmail,
  confidence: number
) {
  appendEmailParseImprovementRequest({
    result: context.result,
    request: {
      rawText: buildEmailParseImprovementRawText(email),
      source: getTransactionSource(email.provider),
      status: "needs_review",
      confidence,
      parseMethod: "llm",
    },
  });
}
