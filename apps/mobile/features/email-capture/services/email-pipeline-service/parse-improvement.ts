import { appendEmailParseImprovementRequest, getTransactionSource } from "./shared";
import type { PipelineResult, RawEmail } from "./types";

const buildEmailParseImprovementRawText = (email: RawEmail): string =>
  [email.subject, email.body].filter((part) => part.trim().length > 0).join("\n\n");

export function appendFailedEmailParseImprovementRequest(
  result: PipelineResult,
  email: RawEmail
): PipelineResult {
  return appendEmailParseImprovementRequest({
    result,
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
  result: PipelineResult,
  email: RawEmail,
  confidence: number
): PipelineResult {
  return appendEmailParseImprovementRequest({
    result,
    request: {
      rawText: buildEmailParseImprovementRawText(email),
      source: getTransactionSource(email.provider),
      status: "needs_review",
      confidence,
      parseMethod: "llm",
    },
  });
}
