import { captureErrorEffect } from "@/shared/effect/telemetry";
import { isMaxRetriesReached } from "../../lib/retry-backoff";
import {
  findDuplicateTransactionEffect,
  getPendingRetryEmailSourceEventsEffect,
  markSourceEventForRetryEffect,
  markSourceEventPermanentlyFailedEffect,
  markSourceEventRetrySuccessEffect,
  nextRetryAtEffect,
  resolveRetryEmailBodyEffect,
  updateProcessedSourceEventStatusEffect,
} from "./runtime";
import { parseEmailBodyOrReport } from "./parse-email-body";
import { incrementRetryMetric } from "./shared";
import { saveRetryTransactionEffect } from "./transactions";
import type {
  EmailSaveStatus,
  LlmParsedTransaction,
  ProcessedSourceEventId,
  ProcessedSourceEventRow,
  ProcessRetriesInput,
  RetryBatchContext,
  RetryDuplicateOutcome,
  RetryEmailSnapshot,
  RetryParseOutcome,
  RetryResult,
  TransactionId,
} from "./types";

const getRetryEmailProvider = (email: ProcessedSourceEventRow) =>
  email.sourceId.startsWith("email_outlook") ? "outlook" : "gmail";

function nullableValue<T>(value: T | null | undefined) {
  return value ?? null;
}

const toRetryEmailSnapshot = (email: ProcessedSourceEventRow): RetryEmailSnapshot => ({
  id: email.id,
  externalId: email.sourceEventId,
  provider: getRetryEmailProvider(email),
  status: email.status,
  failureReason: nullableValue(email.failureReason),
  subject: "",
  rawBodyPreview: null,
  receivedAt: email.receivedAt,
  transactionId: nullableValue(email.transactionId),
  confidence: nullableValue(email.confidence),
  createdAt: email.createdAt,
  rawBody: null,
  retryCount: email.retryCount,
  nextRetryAt: email.nextRetryAt,
});

async function parseRetryEmail(
  context: RetryBatchContext,
  input: {
    readonly provider: "gmail" | "outlook";
    readonly rawBody: string;
  }
): Promise<RetryParseOutcome> {
  const result = await parseEmailBodyOrReport(context, {
    body: input.rawBody,
    provider: input.provider,
    warningName: "email_retry_parse_exception",
  });
  return result.kind === "failed"
    ? { kind: "retry" }
    : result.parsed
      ? { kind: "parsed", parsed: result.parsed }
      : { kind: "skipped" };
}

async function markRetryAsPermanentlyFailed(
  context: RetryBatchContext,
  email: ProcessedSourceEventRow
) {
  await context.runtime.runEmailEffect(
    markSourceEventPermanentlyFailedEffect(context.db, email.id as ProcessedSourceEventId)
  );
  incrementRetryMetric(context.result, "permanentlyFailed");
}

async function scheduleRetryOrFail(context: RetryBatchContext, email: ProcessedSourceEventRow) {
  const retryCount = (email.retryCount ?? 0) + 1;
  const nextRetryAt = await context.runtime.runClockEffect(nextRetryAtEffect(retryCount));

  if (isMaxRetriesReached(retryCount)) {
    await markRetryAsPermanentlyFailed(context, email);
    return;
  }

  await context.runtime.runEmailEffect(
    markSourceEventForRetryEffect({
      db: context.db,
      id: email.id as ProcessedSourceEventId,
      retryCount,
      nextRetryAt,
    })
  );
  incrementRetryMetric(context.result, "retried");
}

async function handleRetryParseOutcome(
  context: RetryBatchContext,
  email: ProcessedSourceEventRow,
  kind: Exclude<RetryParseOutcome["kind"], "parsed">
) {
  if (kind === "retry") {
    await scheduleRetryOrFail(context, email);
    return;
  }

  await context.runtime.runEmailEffect(
    updateProcessedSourceEventStatusEffect({
      db: context.db,
      id: email.id as ProcessedSourceEventId,
      status: "dismissed",
      transactionId: null,
    })
  );
}

async function lookupRetryDuplicate(
  context: RetryBatchContext,
  parsed: LlmParsedTransaction
): Promise<RetryDuplicateOutcome> {
  try {
    const transactionId = await context.runtime.runEmailEffect(
      findDuplicateTransactionEffect(context.db, context.userId, parsed)
    );
    return transactionId ? { kind: "duplicate", transactionId } : { kind: "new" };
  } catch (error) {
    await context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return { kind: "retry" };
  }
}

async function finalizeRetrySuccess(input: {
  readonly context: RetryBatchContext;
  readonly email: ProcessedSourceEventRow;
  readonly transactionId: TransactionId | null;
  readonly status: EmailSaveStatus | "duplicate";
  readonly confidence: number;
}) {
  await input.context.runtime.runEmailEffect(
    markSourceEventRetrySuccessEffect({
      db: input.context.db,
      id: input.email.id as ProcessedSourceEventId,
      status:
        input.status === "duplicate"
          ? "duplicate"
          : input.status === "success"
            ? "processed"
            : "needs_review",
      transactionId: input.transactionId,
      confidence: input.confidence,
    })
  );
  incrementRetryMetric(input.context.result, "succeeded");
}

async function persistRetryTransaction(input: {
  readonly context: RetryBatchContext;
  readonly email: ProcessedSourceEventRow;
  readonly parsed: LlmParsedTransaction;
}) {
  try {
    await input.context.runtime.runEmailWithClock(
      saveRetryTransactionEffect({
        db: input.context.db,
        userId: input.context.userId,
        parsed: input.parsed,
        email: toRetryEmailSnapshot(input.email),
        processedSourceEventId: input.email.id,
      })
    );
    incrementRetryMetric(input.context.result, "succeeded");
    return true;
  } catch (error) {
    await input.context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return false;
  }
}

async function processParsedRetryEmail(
  context: RetryBatchContext,
  email: ProcessedSourceEventRow,
  parsed: LlmParsedTransaction
) {
  const duplicate = await lookupRetryDuplicate(context, parsed);
  if (duplicate.kind === "retry") {
    await scheduleRetryOrFail(context, email);
    return;
  }

  if (duplicate.kind === "duplicate") {
    await finalizeRetrySuccess({
      context,
      email,
      transactionId: duplicate.transactionId,
      status: "duplicate",
      confidence: parsed.confidence,
    });
    return;
  }

  const saved = await persistRetryTransaction({ context, email, parsed });
  if (!saved) {
    await scheduleRetryOrFail(context, email);
  }
}

async function processRetryEmail(context: RetryBatchContext, email: ProcessedSourceEventRow) {
  const rawBody = await context.runtime.runEmailEffect(
    resolveRetryEmailBodyEffect(context.db, context.userId, email)
  );
  if (!rawBody) {
    await markRetryAsPermanentlyFailed(context, email);
    return;
  }

  const parsed = await parseRetryEmail(context, {
    provider: getRetryEmailProvider(email),
    rawBody,
  });
  if (parsed.kind !== "parsed") {
    await handleRetryParseOutcome(context, email, parsed.kind);
    return;
  }

  await processParsedRetryEmail(context, email, parsed.parsed);
}

export async function processRetryBatch(
  runtime: RetryBatchContext["runtime"],
  input: ProcessRetriesInput
) {
  const result: RetryResult = { retried: 0, succeeded: 0, permanentlyFailed: 0 };
  const context: RetryBatchContext = {
    runtime,
    db: input.db,
    userId: input.userId,
    result,
  };
  const pendingSourceEvents = await runtime.runEmailEffect(
    getPendingRetryEmailSourceEventsEffect(input.db, input.userId)
  );

  for (const email of pendingSourceEvents) {
    await processRetryEmail(context, email);
  }

  return result;
}
