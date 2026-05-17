import { captureErrorEffect, capturePipelineEventEffect } from "@/shared/effect/telemetry";
import { buildSkippedEmailDiagnostics } from "./email-telemetry";
import { cacheMerchantRule, lookupIncomingDuplicate } from "./incoming-parsed-helpers";
import { createIncomingEmailPersistenceState, parseIncomingEmail } from "./incoming-parse";
import {
  appendFailedEmailParseImprovementRequest,
  appendNeedsReviewEmailParseImprovementRequest,
} from "./parse-improvement";
import {
  getProcessedEmailSourceEventIdsEffect,
  insertProcessedEmailSourceEventEffect,
  saveEmailCaptureEvidenceEffect,
} from "./runtime";
import {
  buildDuplicateProcessedSourceEventRow,
  buildUnparsedProcessedSourceEventRow,
  createPipelineMetricResult,
  getEmailSourceId,
  getEmailSourceEventKey,
  resolveEmailStatus,
  runSerializedPersistence,
} from "./shared";
import { saveTransactionEffect } from "./transactions";
import type {
  EmailBatchContext,
  EmailSaveStatus,
  IncomingEmailOutcome,
  IncomingEmailPersistenceOutcome,
  LlmParsedTransaction,
  PipelineResult,
  RawEmail,
  TransactionId,
  UnparsedIncomingEmailKind,
} from "./types";

const nowMs = (): number => Date.now();

type IncomingEmailPersistenceInput = {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly sourceEventRow: Parameters<typeof insertProcessedEmailSourceEventEffect>[1];
  readonly processedSourceEventId: Parameters<
    typeof saveEmailCaptureEvidenceEffect
  >[0]["processedSourceEventId"];
  readonly transactionId: TransactionId | null;
  readonly createdAt: Parameters<typeof saveEmailCaptureEvidenceEffect>[0]["now"];
};

async function persistIncomingEmailRecord(input: IncomingEmailPersistenceInput) {
  await input.context.runtime.runEmailEffect(
    insertProcessedEmailSourceEventEffect(input.context.db, input.sourceEventRow)
  );
  await input.context.runtime.runEmailEffect(
    saveEmailCaptureEvidenceEffect({
      db: input.context.db,
      userId: input.context.userId,
      from: input.email.from,
      body: input.email.body,
      processedSourceEventId: input.processedSourceEventId,
      transactionId: input.transactionId,
      now: input.createdAt,
    })
  );
}

async function persistFailedIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail,
  failureReason: string | null
): Promise<PipelineResult> {
  const sourceEventIds = await context.runtime.runEmailEffect(
    getProcessedEmailSourceEventIdsEffect(context.db, context.userId, [
      { sourceId: getEmailSourceId(email), sourceEventId: email.externalId },
    ])
  );
  if (sourceEventIds.has(getEmailSourceEventKey(email))) {
    return createPipelineMetricResult("failed");
  }

  const { createdAt, processedSourceEventId } = await createIncomingEmailPersistenceState(
    context,
    email
  );
  const sourceEventRow = buildUnparsedProcessedSourceEventRow({
    email,
    userId: context.userId,
    processedSourceEventId,
    createdAt,
    status: "failed",
    failureReason,
    nextRetryAt: null,
  });

  await persistIncomingEmailRecord({
    context,
    email,
    sourceEventRow,
    processedSourceEventId,
    transactionId: null,
    createdAt,
  });
  const result = createPipelineMetricResult("failed");
  return failureReason === "parse_error"
    ? appendFailedEmailParseImprovementRequest(result, email)
    : result;
}

async function persistSkippedIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail,
  kind: Exclude<UnparsedIncomingEmailKind, "failed">
): Promise<PipelineResult> {
  const { createdAt, processedSourceEventId } = await createIncomingEmailPersistenceState(
    context,
    email
  );
  const metadataOnlyEmail = { ...email, subject: "", body: "" };
  const sourceEventRow = buildUnparsedProcessedSourceEventRow({
    email: metadataOnlyEmail,
    userId: context.userId,
    processedSourceEventId,
    createdAt,
    status: "dismissed",
    failureReason: null,
    nextRetryAt: null,
  });

  await context.runtime.runEmailEffect(
    insertProcessedEmailSourceEventEffect(context.db, sourceEventRow)
  );
  const diagnostics = buildSkippedEmailDiagnostics({ email, reason: kind });
  await context.runtime.runTelemetryEffect(capturePipelineEventEffect(diagnostics));
  return createPipelineMetricResult(kind === "filtered" ? "filtered" : "failed");
}

async function persistDuplicateIncomingEmail(input: {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly parsed: LlmParsedTransaction;
  readonly transactionId: TransactionId;
}) {
  const { createdAt, processedSourceEventId } = await createIncomingEmailPersistenceState(
    input.context,
    input.email
  );
  const sourceEventRow = buildDuplicateProcessedSourceEventRow({
    email: input.email,
    userId: input.context.userId,
    processedSourceEventId,
    transactionId: input.transactionId,
    confidence: input.parsed.confidence,
    createdAt,
  });

  await persistIncomingEmailRecord({
    context: input.context,
    email: input.email,
    sourceEventRow,
    processedSourceEventId,
    transactionId: input.transactionId,
    createdAt,
  });
  return createPipelineMetricResult("skippedCrossSource");
}

async function persistIncomingTransaction(input: {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly parsed: LlmParsedTransaction;
  readonly status: EmailSaveStatus;
}): Promise<EmailSaveStatus | null> {
  try {
    const persistedStatus = await input.context.runtime.runEmailWithClock(
      saveTransactionEffect({
        db: input.context.db,
        userId: input.context.userId,
        parsed: input.parsed,
        email: input.email,
        status: input.status,
      })
    );
    if (persistedStatus === "success") {
      await cacheMerchantRule({ context: input.context, parsed: input.parsed });
    }
    return persistedStatus;
  } catch (error) {
    await input.context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return null;
  }
}

async function processParsedIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail,
  parsed: LlmParsedTransaction
): Promise<IncomingEmailPersistenceOutcome> {
  const persistenceStartedAt = nowMs();
  const result = await runSerializedPersistence(context, async () => {
    const duplicate = await lookupIncomingDuplicate(context, parsed);
    if (duplicate.kind === "failed") {
      return persistFailedIncomingEmail(context, email, null);
    }

    if (duplicate.kind === "duplicate") {
      return persistDuplicateIncomingEmail({
        context,
        email,
        parsed,
        transactionId: duplicate.transactionId,
      });
    }

    const status = resolveEmailStatus(parsed.confidence);
    const persistedStatus = await persistIncomingTransaction({ context, email, parsed, status });
    if (persistedStatus === null) {
      return persistFailedIncomingEmail(context, email, null);
    }

    const savedResult = createPipelineMetricResult(
      persistedStatus === "success" ? "saved" : "needsReview"
    );
    if (persistedStatus === "needs_review") {
      return appendNeedsReviewEmailParseImprovementRequest(savedResult, email, parsed.confidence);
    }
    return savedResult;
  });

  return {
    result,
    persistenceDurationMs: nowMs() - persistenceStartedAt,
    savedTransaction: result.saved > 0 || result.needsReview > 0,
  };
}

export async function processIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail
): Promise<IncomingEmailOutcome> {
  const parseStartedAt = nowMs();
  const parsed = await parseIncomingEmail(context, email);
  const parseDurationMs = nowMs() - parseStartedAt;
  if (parsed.kind !== "parsed") {
    if (parsed.kind === "failed") {
      const persistenceStartedAt = nowMs();
      const result = await persistFailedIncomingEmail(context, email, "parse_error");
      return {
        result,
        parseDurationMs,
        persistenceDurationMs: nowMs() - persistenceStartedAt,
        savedTransaction: false,
      };
    }

    const persistenceStartedAt = nowMs();
    const result = await persistSkippedIncomingEmail(context, email, parsed.kind);
    return {
      result,
      parseDurationMs,
      persistenceDurationMs: nowMs() - persistenceStartedAt,
      savedTransaction: false,
    };
  }

  const persistence = await processParsedIncomingEmail(context, email, parsed.parsed);
  return {
    result: persistence.result,
    parseDurationMs,
    persistenceDurationMs: persistence.persistenceDurationMs,
    savedTransaction: persistence.savedTransaction,
  };
}
