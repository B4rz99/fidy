import { capturePipelineEvent } from "@/shared/lib";
import type { RetryResult } from "../pipeline.public";

type EmailFetchTelemetryResult = {
  readonly account: { readonly provider: string };
  readonly rawEmails: readonly unknown[];
  readonly fetchOk: boolean;
  readonly fetchDurationMs: number;
};

const providerFamiliesForResults = (fetchResults: readonly EmailFetchTelemetryResult[]): string[] =>
  Array.from(new Set(fetchResults.map((result) => result.account.provider))).sort();

export function captureEmailFetchBatchTelemetry(input: {
  readonly fetchResults: readonly EmailFetchTelemetryResult[];
  readonly fetchDurationMs: number;
}) {
  const providerFamilies = providerFamiliesForResults(input.fetchResults);
  const event = {
    source: "email",
    schema: "email_fetch_batch_v1",
    accountCount: input.fetchResults.length,
    successfulFetchCount: input.fetchResults.filter((result) => result.fetchOk).length,
    failedFetchCount: input.fetchResults.filter((result) => !result.fetchOk).length,
    fetchedCount: input.fetchResults.reduce((count, result) => count + result.rawEmails.length, 0),
    providerFamilyCount: providerFamilies.length,
    providerFamilies: providerFamilies.join(","),
    fetchDurationMs: input.fetchDurationMs,
    maxProviderFetchDurationMs: Math.max(
      0,
      ...input.fetchResults.map((result) => result.fetchDurationMs)
    ),
  };
  capturePipelineEvent(event);
}

export function captureEmailRetryBatchTelemetry(input: {
  readonly retryResult: RetryResult;
  readonly retryDurationMs: number;
}) {
  const event = {
    source: "email",
    schema: "email_retry_batch_v1",
    retried: input.retryResult.retried,
    succeeded: input.retryResult.succeeded,
    permanentlyFailed: input.retryResult.permanentlyFailed,
    retryDurationMs: input.retryDurationMs,
  };
  capturePipelineEvent(event);
}
