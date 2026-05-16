import { getBuiltInCategoryId, isValidCategoryId } from "@/shared/categories";
import { assertCopAmount, assertIsoDate, requireIsoDateTime } from "@/shared/types/assertions";
import type { ProcessedEmailRow, ProcessedSourceEventRow } from "../../lib/repository";
import type {
  AppendEmailParseImprovementRequestInput,
  DuplicateProcessedEmailRowInput,
  DuplicateProcessedSourceEventRowInput,
  EmailBatchContext,
  EmailMetric,
  EmailQueue,
  EmailSaveStatus,
  PipelineResult,
  RetryResult,
  TrackSavedTransactionInput,
  UnparsedProcessedEmailRowInput,
  UnparsedProcessedSourceEventRowInput,
} from "./types";

export function getTransactionSource(provider: string) {
  return provider === "gmail" ? "email_gmail" : "email_outlook";
}

export const getEmailSourceEventKey = (email: {
  readonly provider: string;
  readonly externalId: string;
}) => `${getTransactionSource(email.provider)}:${email.externalId}`;

export const getParsedCounterpartyName = (parsed: {
  readonly description: string;
  readonly counterpartyHint?: string;
}) => {
  const hint = parsed.counterpartyHint?.trim();
  return hint && hint.length > 0 ? hint : parsed.description.trim();
};

export function getPersistedCategoryId(categoryId: string) {
  return isValidCategoryId(categoryId) ? categoryId : getBuiltInCategoryId("other");
}

export function getProgressSnapshot(total: number, completed: number, result: PipelineResult) {
  return {
    total,
    completed,
    saved: result.saved,
    failed: result.failed,
    needsReview: result.needsReview,
  };
}

export function resolveEmailStatus(confidence: number): EmailSaveStatus {
  return confidence < 0.7 ? "needs_review" : "success";
}

export function assertParsedTransaction(parsed: TrackSavedTransactionInput["parsed"]) {
  assertCopAmount(parsed.amount);
  assertIsoDate(parsed.date);
}

export const createPipelineMetricResult = (field: EmailMetric): PipelineResult => ({
  ...createPipelineResult(0),
  [field]: 1,
});

export const appendEmailParseImprovementRequest = (
  input: AppendEmailParseImprovementRequestInput
): PipelineResult => ({
  ...input.result,
  parseImprovementRequests: [...input.result.parseImprovementRequests, input.request],
});

export const mergePipelineResults = (results: readonly PipelineResult[]): PipelineResult =>
  results.reduce(
    (total, result) => ({
      filtered: total.filtered + result.filtered,
      skippedDuplicate: total.skippedDuplicate + result.skippedDuplicate,
      skippedCrossSource: total.skippedCrossSource + result.skippedCrossSource,
      saved: total.saved + result.saved,
      failed: total.failed + result.failed,
      pendingRetry: total.pendingRetry + result.pendingRetry,
      needsReview: total.needsReview + result.needsReview,
      parseImprovementRequests: [
        ...total.parseImprovementRequests,
        ...result.parseImprovementRequests,
      ],
    }),
    createPipelineResult(0)
  );

export function incrementRetryMetric(result: RetryResult, field: keyof RetryResult) {
  result[field] += 1;
}

export function getNextQueuedEmail(queue: EmailQueue) {
  const email = queue.emails[queue.nextIdx];
  queue.nextIdx += 1;
  return email ?? null;
}

export async function runSerializedPersistence<T>(
  context: EmailBatchContext,
  operation: () => Promise<T>
): Promise<T> {
  const previous = context.persistenceGate;
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  context.persistenceGate = previous.then(
    () => current,
    () => current
  );

  await previous;
  try {
    return await operation();
  } finally {
    releaseCurrent();
  }
}

export function dedupeRawEmails(rawEmails: EmailQueue["emails"]) {
  return Array.from(
    new Map(rawEmails.map((email) => [getEmailSourceEventKey(email), email])).values()
  );
}

export function createPipelineResult(skippedDuplicate: number): PipelineResult {
  return {
    filtered: 0,
    skippedDuplicate,
    skippedCrossSource: 0,
    saved: 0,
    failed: 0,
    pendingRetry: 0,
    needsReview: 0,
    parseImprovementRequests: [],
  };
}

export function buildUnparsedProcessedEmailRow(
  input: UnparsedProcessedEmailRowInput
): ProcessedEmailRow {
  const baseRow: ProcessedEmailRow = {
    id: input.processedEmailId,
    externalId: input.email.externalId,
    provider: input.email.provider,
    status: input.status,
    failureReason: input.failureReason,
    subject: input.email.subject,
    rawBodyPreview: input.email.body.slice(0, 500),
    receivedAt: requireIsoDateTime(input.email.receivedAt),
    transactionId: null,
    confidence: null,
    createdAt: input.createdAt,
  };

  return input.status === "pending_retry"
    ? {
        ...baseRow,
        rawBody: input.email.body,
        retryCount: 0,
        nextRetryAt: input.nextRetryAt,
      }
    : baseRow;
}

export function buildUnparsedProcessedSourceEventRow(
  input: UnparsedProcessedSourceEventRowInput
): ProcessedSourceEventRow {
  const baseRow: ProcessedSourceEventRow = {
    id: input.processedSourceEventId,
    userId: input.userId,
    sourceFamily: "email",
    sourceId: getTransactionSource(input.email.provider),
    sourceEventId: input.email.externalId,
    status: input.status,
    failureReason: input.failureReason,
    subject: input.email.subject,
    rawBodyPreview: input.email.body.slice(0, 500),
    receivedAt: requireIsoDateTime(input.email.receivedAt),
    processedAt: input.createdAt,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    deletedAt: null,
    transactionId: null,
    confidence: null,
  };

  return input.status === "pending_retry"
    ? {
        ...baseRow,
        rawBody: input.email.body,
        retryCount: 0,
        nextRetryAt: input.nextRetryAt,
      }
    : baseRow;
}

export function buildDuplicateProcessedEmailRow(
  input: DuplicateProcessedEmailRowInput
): ProcessedEmailRow {
  return {
    id: input.processedEmailId,
    externalId: input.email.externalId,
    provider: input.email.provider,
    status: "skipped_duplicate",
    failureReason: null,
    subject: input.email.subject,
    rawBodyPreview: input.email.body.slice(0, 500),
    receivedAt: requireIsoDateTime(input.email.receivedAt),
    transactionId: input.transactionId,
    confidence: input.confidence,
    createdAt: input.createdAt,
  };
}

export function buildDuplicateProcessedSourceEventRow(
  input: DuplicateProcessedSourceEventRowInput
): ProcessedSourceEventRow {
  return {
    id: input.processedSourceEventId,
    userId: input.userId,
    sourceFamily: "email",
    sourceId: getTransactionSource(input.email.provider),
    sourceEventId: input.email.externalId,
    status: "duplicate",
    failureReason: null,
    subject: input.email.subject,
    rawBodyPreview: input.email.body.slice(0, 500),
    receivedAt: requireIsoDateTime(input.email.receivedAt),
    processedAt: input.createdAt,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    deletedAt: null,
    transactionId: input.transactionId,
    confidence: input.confidence,
  };
}
