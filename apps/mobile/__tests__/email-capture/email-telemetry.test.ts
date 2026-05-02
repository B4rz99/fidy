import { describe, expect, it } from "vitest";
import type { RawEmail } from "@/features/email-capture/schema";
import {
  buildEmailPipelineBatchTelemetry,
  buildSkippedEmailDiagnostics,
} from "@/features/email-capture/services/email-pipeline-service/email-telemetry";

const rawEmail: RawEmail = {
  externalId: "gmail-raw-123",
  from: "alerts@bank.example.com",
  subject: "Compra aprobada en Exito por $50.000",
  body: "Compra aprobada en Exito por $50.000 con tarjeta 1234. user@example.com",
  receivedAt: "2026-03-05T10:00:00Z",
  provider: "gmail",
};

describe("email pipeline telemetry", () => {
  it("builds a structural batch event without email identifiers or content", () => {
    const event = buildEmailPipelineBatchTelemetry({
      rawEmails: [rawEmail],
      dedupedInBatch: 0,
      skippedAlreadyProcessed: 0,
      result: {
        filtered: 1,
        skippedDuplicate: 0,
        skippedCrossSource: 0,
        saved: 0,
        failed: 0,
        pendingRetry: 0,
        needsReview: 0,
      },
    });

    expect(event).toEqual({
      source: "email",
      schema: "email_pipeline_batch_v1",
      batchSize: 1,
      providerFamilyCount: 1,
      providerFamilies: "gmail",
      dedupedInBatch: 0,
      skippedAlreadyProcessed: 0,
      skippedCrossSource: 0,
      skippedDuplicate: 0,
      filtered: 1,
      saved: 0,
      failed: 0,
      pendingRetry: 0,
      needsReview: 0,
    });
    expect(Object.keys(event).join(" ")).not.toMatch(/body|subject|email|merchant|amount/i);
    expect(Object.values(event).join(" ")).not.toContain("Exito");
    expect(Object.values(event).join(" ")).not.toContain("50.000");
    expect(Object.values(event).join(" ")).not.toContain("user@example.com");
  });

  it("builds skipped-email diagnostics without sender or template identifiers", () => {
    const diagnostics = buildSkippedEmailDiagnostics({ email: rawEmail, reason: "filtered" });

    expect(diagnostics).toEqual({
      source: "email",
      schema: "email_skipped_v1",
      providerFamily: "gmail",
      skipReason: "filtered",
      headerLengthBucket: "20_49",
      contentLengthBucket: "50_99",
      hasCurrencySymbol: true,
      hasDigitRun: true,
    });
    expect(Object.keys(diagnostics).join(" ")).not.toMatch(
      /body|subject|address|merchant|amount|sender|fingerprint/i
    );
    expect(Object.values(diagnostics).join(" ")).not.toContain("Exito");
    expect(Object.values(diagnostics).join(" ")).not.toContain("50.000");
    expect(Object.values(diagnostics).join(" ")).not.toContain("user@example.com");
    expect(Object.values(diagnostics).join(" ")).not.toContain("alerts@");
    expect(Object.values(diagnostics).join(" ")).not.toContain("bank.example.com");
  });
});
