import { appendEmailParseImprovementRequest, getTransactionSource } from "./shared";
import { buildEmailParseImprovementRawText, getEmailSenderDomain } from "../bank-email-parser";
import { buildEmailParserTemplate } from "../email-parser-template";
import type { PipelineResult, RawEmail } from "./types";

export function appendFailedEmailParseImprovementRequest(
  result: PipelineResult,
  email: RawEmail
): PipelineResult {
  return appendEmailParseImprovementRequest({
    result,
    request: {
      rawText: buildEmailParseImprovementRawText(email),
      parserTemplate: buildEmailParserTemplate(buildEmailParseImprovementRawText(email)),
      senderDomain: getEmailSenderDomain(email),
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
      parserTemplate: buildEmailParserTemplate(buildEmailParseImprovementRawText(email)),
      senderDomain: getEmailSenderDomain(email),
      source: getTransactionSource(email.provider),
      status: "needs_review",
      confidence,
      parseMethod: "llm",
    },
  });
}
