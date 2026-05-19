import { describe, expect, it } from "vitest";
import {
  appendFailedEmailParseImprovementRequest,
  appendNeedsReviewEmailParseImprovementRequest,
} from "@/features/email-capture/services/email-pipeline-service/parse-improvement";

const emptyResult = {
  filtered: 0,
  skippedDuplicate: 0,
  skippedCrossSource: 0,
  saved: 0,
  failed: 0,
  pendingRetry: 0,
  needsReview: 0,
  parseImprovementRequests: [],
};

describe("email parse improvement requests", () => {
  it("trims empty subject/body parts from failed parse samples", () => {
    const result = appendFailedEmailParseImprovementRequest(emptyResult, {
      externalId: "email-1",
      from: "bank@example.com",
      subject: "   ",
      body: "Compra aprobada",
      receivedAt: "2026-03-05T10:00:00Z",
      provider: "gmail",
    });

    expect(result.parseImprovementRequests).toEqual([
      {
        parserTemplate: "Compra aprobada",
        rawText: "Compra aprobada",
        senderDomain: "example.com",
        source: "email_gmail",
        status: "failed",
        confidence: null,
        parseMethod: "llm",
      },
    ]);
  });

  it("joins non-empty subject and body for needs-review samples", () => {
    const result = appendNeedsReviewEmailParseImprovementRequest(
      emptyResult,
      {
        externalId: "email-1",
        from: "bank@example.com",
        subject: "Compra aprobada",
        body: "Su compra por $50.000 fue aprobada",
        receivedAt: "2026-03-05T10:00:00Z",
        provider: "outlook",
      },
      0.4
    );

    expect(result.parseImprovementRequests).toEqual([
      {
        parserTemplate: "Compra aprobada Su compra por [AMOUNT] fue aprobada",
        rawText: "Compra aprobada\n\nSu compra por $50.000 fue aprobada",
        senderDomain: "example.com",
        source: "email_outlook",
        status: "needs_review",
        confidence: 0.4,
        parseMethod: "llm",
      },
    ]);
  });
});
