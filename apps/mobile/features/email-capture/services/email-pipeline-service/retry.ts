import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { captureErrorEffect, captureWarningEffect } from "@/shared/effect/telemetry";
import { isMaxRetriesReached } from "../../lib/retry-backoff";
import {
  findDuplicateTransactionEffect,
  getPendingRetryEmailsEffect,
  linkCaptureEvidenceToTransactionEffect,
  markForRetryEffect,
  markPermanentlyFailedEffect,
  markRetryTerminalStatusEffect,
  markRetrySuccessEffect,
  nextRetryAtEffect,
  parseBodyEffect,
} from "./runtime";
import { incrementRetryMetric } from "./shared";
import { saveRetryTransactionEffect } from "./transactions";
import type {
  EmailSaveStatus,
  LlmParsedTransaction,
  ProcessedEmailId,
  ProcessedEmailRow,
  ProcessRetriesInput,
  RetryBatchContext,
  RetryDuplicateOutcome,
  RetryParseOutcome,
  RetryResult,
  TransactionId,
} from "./types";

async function parseRetryEmail(
  context: RetryBatchContext,
  input: {
    readonly provider: ProcessedEmailRow["provider"];
    readonly rawBody: string;
  }
): Promise<RetryParseOutcome> {
  try {
    const parsed = await context.runtime.runEmailEffect(
      parseBodyEffect(context.db, context.userId, input.rawBody)
    );
    return parsed ? { kind: "parsed", parsed } : { kind: "skipped" };
  } catch (error) {
    await context.runtime.runTelemetryEffect(
      captureWarningEffect("email_retry_parse_exception", {
        provider: input.provider,
        errorType: error instanceof Error ? error.message : "unknown",
      })
    );
    return { kind: "retry" };
  }
}

async function markRetryAsPermanentlyFailed(context: RetryBatchContext, id: ProcessedEmailId) {
  await context.runtime.runEmailEffect(markPermanentlyFailedEffect(context.db, id));
  incrementRetryMetric(context.result, "permanentlyFailed");
}

async function scheduleRetryOrFail(context: RetryBatchContext, email: ProcessedEmailRow) {
  const retryCount = (email.retryCount ?? 0) + 1;
  const nextRetryAt = await context.runtime.runClockEffect(nextRetryAtEffect(retryCount));

  if (isMaxRetriesReached(retryCount)) {
    await markRetryAsPermanentlyFailed(context, email.id);
    return;
  }

  await context.runtime.runEmailEffect(
    markForRetryEffect({
      db: context.db,
      id: email.id,
      retryCount,
      nextRetryAt,
    })
  );
  incrementRetryMetric(context.result, "retried");
}

async function handleRetryParseOutcome(
  context: RetryBatchContext,
  email: ProcessedEmailRow,
  kind: Exclude<RetryParseOutcome["kind"], "parsed">
) {
  if (kind === "retry") {
    await scheduleRetryOrFail(context, email);
    return;
  }

  await context.runtime.runEmailEffect(
    markRetryTerminalStatusEffect({
      db: context.db,
      id: email.id,
      status: "skipped",
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
  readonly emailId: ProcessedEmailId;
  readonly transactionId: TransactionId | null;
  readonly status: EmailSaveStatus;
  readonly confidence: number;
}) {
  const updatedAt = await input.context.runtime.runClockEffect(currentIsoDateTimeEffect);

  if (input.transactionId !== null) {
    await input.context.runtime.runEmailEffect(
      linkCaptureEvidenceToTransactionEffect({
        db: input.context.db,
        processedEmailId: input.emailId,
        transactionId: input.transactionId,
        updatedAt,
      })
    );
  }
  await input.context.runtime.runEmailEffect(
    markRetrySuccessEffect({
      db: input.context.db,
      id: input.emailId,
      status: input.status,
      transactionId: input.transactionId,
      confidence: input.confidence,
    })
  );
  incrementRetryMetric(input.context.result, "succeeded");
}

async function persistRetryTransaction(input: {
  readonly context: RetryBatchContext;
  readonly email: ProcessedEmailRow;
  readonly parsed: LlmParsedTransaction;
}) {
  try {
    const { txId, status } = await input.context.runtime.runEmailWithClock(
      saveRetryTransactionEffect({
        db: input.context.db,
        userId: input.context.userId,
        parsed: input.parsed,
        email: input.email,
      })
    );
    await finalizeRetrySuccess({
      context: input.context,
      emailId: input.email.id,
      transactionId: txId,
      status,
      confidence: input.parsed.confidence,
    });
    return true;
  } catch (error) {
    await input.context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return false;
  }
}

async function processParsedRetryEmail(
  context: RetryBatchContext,
  email: ProcessedEmailRow,
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
      emailId: email.id,
      transactionId: duplicate.transactionId,
      status: "success",
      confidence: parsed.confidence,
    });
    return;
  }

  const saved = await persistRetryTransaction({ context, email, parsed });
  if (!saved) {
    await scheduleRetryOrFail(context, email);
  }
}

async function processRetryEmail(context: RetryBatchContext, email: ProcessedEmailRow) {
  const { rawBody } = email;
  if (!rawBody) {
    await markRetryAsPermanentlyFailed(context, email.id);
    return;
  }

  const parsed = await parseRetryEmail(context, {
    provider: email.provider,
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
  const pendingEmails = await runtime.runEmailEffect(
    getPendingRetryEmailsEffect(input.db, input.userId)
  );

  for (const email of pendingEmails) {
    await processRetryEmail(context, email);
  }

  return result;
}
