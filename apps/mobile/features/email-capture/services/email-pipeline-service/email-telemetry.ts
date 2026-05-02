import type { TelemetryContext } from "@/shared/effect/telemetry";
import type { PipelineResult, RawEmail } from "./types";

type BatchTelemetryInput = {
  readonly rawEmails: readonly RawEmail[];
  readonly dedupedInBatch: number;
  readonly skippedAlreadyProcessed: number;
  readonly result: PipelineResult;
};

type SkippedEmailDiagnosticsInput = {
  readonly email: RawEmail;
  readonly reason: "filtered" | "failed";
};

const lengthBucket = (value: string): string => {
  if (value.length < 20) return "0_19";
  if (value.length < 50) return "20_49";
  if (value.length < 100) return "50_99";
  if (value.length < 250) return "100_249";
  if (value.length < 500) return "250_499";
  return "500_plus";
};

export function buildEmailPipelineBatchTelemetry(input: BatchTelemetryInput): TelemetryContext {
  const providerFamilies = Array.from(
    new Set(input.rawEmails.map((email) => email.provider))
  ).sort();

  return {
    source: "email",
    schema: "email_pipeline_batch_v1",
    batchSize: input.rawEmails.length,
    providerFamilyCount: providerFamilies.length,
    providerFamilies: providerFamilies.join(","),
    dedupedInBatch: input.dedupedInBatch,
    skippedAlreadyProcessed: input.skippedAlreadyProcessed,
    skippedCrossSource: input.result.skippedCrossSource,
    skippedDuplicate: input.result.skippedDuplicate,
    filtered: input.result.filtered,
    saved: input.result.saved,
    failed: input.result.failed,
    pendingRetry: input.result.pendingRetry,
    needsReview: input.result.needsReview,
  };
}

export function buildSkippedEmailDiagnostics(
  input: SkippedEmailDiagnosticsInput
): TelemetryContext {
  return {
    source: "email",
    schema: "email_skipped_v1",
    providerFamily: input.email.provider,
    skipReason: input.reason,
    headerLengthBucket: lengthBucket(input.email.subject),
    contentLengthBucket: lengthBucket(input.email.body),
    hasCurrencySymbol: /[$]/u.test(input.email.body),
    hasDigitRun: /\d{2,}/u.test(input.email.body),
  };
}
