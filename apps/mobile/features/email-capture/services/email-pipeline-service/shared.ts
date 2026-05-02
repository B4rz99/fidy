import type { ProcessedEmailRow } from "@/features/email-capture/lib/repository";
import { getBuiltInCategoryId, isValidCategoryId } from "@/shared/categories";
import { assertCopAmount, assertIsoDate, requireIsoDateTime } from "@/shared/types/assertions";
import type {
  DuplicateProcessedEmailRowInput,
  EmailBatchContext,
  EmailMetric,
  EmailQueue,
  EmailSaveStatus,
  PipelineResult,
  RetryResult,
  TrackSavedTransactionInput,
  UnparsedProcessedEmailRowInput,
} from "./types";

export function getTransactionSource(provider: string) {
  return provider === "gmail" ? "email_gmail" : "email_outlook";
}

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

export function incrementPipelineMetric(result: PipelineResult, field: EmailMetric) {
  result[field] += 1;
}

export function incrementRetryMetric(result: RetryResult, field: keyof RetryResult) {
  result[field] += 1;
}

export function reportEmailProgress(context: EmailBatchContext) {
  context.onProgress?.(getProgressSnapshot(context.total, context.completed, context.result));
}

export function completeEmailStep(context: EmailBatchContext) {
  context.completed += 1;
  reportEmailProgress(context);
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
  return Array.from(new Map(rawEmails.map((email) => [email.externalId, email])).values());
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
