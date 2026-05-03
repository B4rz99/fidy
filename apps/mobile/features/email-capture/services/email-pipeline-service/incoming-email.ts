import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import {
  captureErrorEffect,
  capturePipelineEventEffect,
  captureWarningEffect,
} from "@/shared/effect/telemetry";
import { generateProcessedEmailId } from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { assertIsoDateTime } from "@/shared/types/assertions";
import { buildSkippedEmailDiagnostics } from "./email-telemetry";
import {
  appendFailedEmailParseImprovementRequest,
  appendNeedsReviewEmailParseImprovementRequest,
} from "./parse-improvement";
import {
  findDuplicateTransactionEffect,
  getProcessedExternalIdsEffect,
  insertMerchantRuleEffect,
  insertProcessedEmailEffect,
  nextRetryAtEffect,
  parseBodyEffect,
  saveEmailCaptureEvidenceEffect,
} from "./runtime";
import {
  buildDuplicateProcessedEmailRow,
  buildUnparsedProcessedEmailRow,
  getPersistedCategoryId,
  incrementPipelineMetric,
  resolveEmailStatus,
  runSerializedPersistence,
} from "./shared";
import { saveTransactionEffect } from "./transactions";
import type {
  DuplicateLookupOutcome,
  EmailBatchContext,
  EmailSaveStatus,
  IncomingEmailPersistenceInput,
  IncomingParseOutcome,
  LlmParsedTransaction,
  RawEmail,
  TransactionId,
  UnparsedIncomingEmailKind,
} from "./types";

async function parseIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail
): Promise<IncomingParseOutcome> {
  try {
    const parsed = await context.runtime.runEmailEffect(
      parseBodyEffect(context.db, context.userId, email.body)
    );
    return parsed ? { kind: "parsed", parsed } : { kind: "filtered" };
  } catch (error) {
    await context.runtime.runTelemetryEffect(
      captureWarningEffect("email_parse_exception", {
        provider: email.provider,
        errorType: error instanceof Error ? error.name : "unknown",
      })
    );
    return { kind: "failed" };
  }
}

async function createIncomingEmailPersistenceState(context: EmailBatchContext, email: RawEmail) {
  assertIsoDateTime(email.receivedAt);
  return {
    createdAt: await context.runtime.runClockEffect(currentIsoDateTimeEffect),
    processedEmailId: generateProcessedEmailId(),
  };
}

async function persistIncomingEmailRecord(input: IncomingEmailPersistenceInput) {
  await input.context.runtime.runEmailEffect(
    insertProcessedEmailEffect(input.context.db, input.row)
  );
  await input.context.runtime.runEmailEffect(
    saveEmailCaptureEvidenceEffect({
      db: input.context.db,
      userId: input.context.userId,
      from: input.email.from,
      body: input.email.body,
      processedEmailId: input.processedEmailId,
      transactionId: input.transactionId,
      now: input.createdAt,
    })
  );
}

async function persistPendingRetryIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail,
  failureReason: string | null
): Promise<boolean> {
  const processedIds = await context.runtime.runEmailEffect(
    getProcessedExternalIdsEffect(context.db, [email.externalId])
  );
  if (processedIds.has(email.externalId)) {
    return false;
  }

  const { createdAt, processedEmailId } = await createIncomingEmailPersistenceState(context, email);
  const nextRetryAt = await context.runtime.runClockEffect(nextRetryAtEffect(0));
  const row = buildUnparsedProcessedEmailRow({
    email,
    processedEmailId,
    createdAt,
    status: "pending_retry",
    failureReason,
    nextRetryAt,
  });

  await persistIncomingEmailRecord({
    context,
    email,
    row,
    processedEmailId,
    transactionId: null,
    createdAt,
  });
  appendFailedEmailParseImprovementRequest(context, email);
  return true;
}

async function persistSkippedIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail,
  kind: Exclude<UnparsedIncomingEmailKind, "failed">
) {
  const { createdAt, processedEmailId } = await createIncomingEmailPersistenceState(context, email);
  const metadataOnlyEmail = { ...email, subject: "", body: "" };
  const row = buildUnparsedProcessedEmailRow({
    email: metadataOnlyEmail,
    processedEmailId,
    createdAt,
    status: "skipped",
    failureReason: null,
    nextRetryAt: null,
  });

  await context.runtime.runEmailEffect(insertProcessedEmailEffect(context.db, row));
  await context.runtime.runTelemetryEffect(
    capturePipelineEventEffect(buildSkippedEmailDiagnostics({ email, reason: kind }))
  );
  incrementPipelineMetric(context.result, kind === "filtered" ? "filtered" : "failed");
}

async function lookupIncomingDuplicate(
  context: EmailBatchContext,
  parsed: LlmParsedTransaction
): Promise<DuplicateLookupOutcome> {
  try {
    const transactionId = await context.runtime.runEmailEffect(
      findDuplicateTransactionEffect(context.db, context.userId, parsed)
    );
    return transactionId ? { kind: "duplicate", transactionId } : { kind: "new" };
  } catch (error) {
    await context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return { kind: "failed" };
  }
}

async function persistDuplicateIncomingEmail(input: {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly parsed: LlmParsedTransaction;
  readonly transactionId: TransactionId;
}) {
  const { createdAt, processedEmailId } = await createIncomingEmailPersistenceState(
    input.context,
    input.email
  );
  const row = buildDuplicateProcessedEmailRow({
    email: input.email,
    processedEmailId,
    transactionId: input.transactionId,
    confidence: input.parsed.confidence,
    createdAt,
  });

  await persistIncomingEmailRecord({
    context: input.context,
    email: input.email,
    row,
    processedEmailId,
    transactionId: input.transactionId,
    createdAt,
  });
  incrementPipelineMetric(input.context.result, "skippedCrossSource");
}

async function cacheMerchantRule(input: {
  readonly context: EmailBatchContext;
  readonly parsed: LlmParsedTransaction;
}) {
  try {
    const createdAt = await input.context.runtime.runClockEffect(currentIsoDateTimeEffect);
    await input.context.runtime.runEmailEffect(
      insertMerchantRuleEffect({
        db: input.context.db,
        userId: input.context.userId,
        merchantKey: normalizeMerchant(input.parsed.description),
        categoryId: getPersistedCategoryId(input.parsed.categoryId),
        createdAt,
      })
    );
  } catch (error) {
    await input.context.runtime.runTelemetryEffect(captureErrorEffect(error));
  }
}

async function persistIncomingTransaction(input: {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly parsed: LlmParsedTransaction;
  readonly status: EmailSaveStatus;
}) {
  try {
    await input.context.runtime.runEmailWithClock(
      saveTransactionEffect({
        db: input.context.db,
        userId: input.context.userId,
        parsed: input.parsed,
        email: input.email,
        status: input.status,
      })
    );
    if (input.status === "success") {
      await cacheMerchantRule({ context: input.context, parsed: input.parsed });
    }
    return true;
  } catch (error) {
    await input.context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return false;
  }
}

async function processParsedIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail,
  parsed: LlmParsedTransaction
) {
  await runSerializedPersistence(context, async () => {
    const duplicate = await lookupIncomingDuplicate(context, parsed);
    if (duplicate.kind === "failed") {
      const queuedRetry = await persistPendingRetryIncomingEmail(context, email, null);
      incrementPipelineMetric(context.result, "failed");
      if (queuedRetry) {
        incrementPipelineMetric(context.result, "pendingRetry");
      }
      return;
    }

    if (duplicate.kind === "duplicate") {
      await persistDuplicateIncomingEmail({
        context,
        email,
        parsed,
        transactionId: duplicate.transactionId,
      });
      return;
    }

    const status = resolveEmailStatus(parsed.confidence);
    const saved = await persistIncomingTransaction({ context, email, parsed, status });
    if (!saved) {
      const queuedRetry = await persistPendingRetryIncomingEmail(context, email, null);
      incrementPipelineMetric(context.result, "failed");
      if (queuedRetry) {
        incrementPipelineMetric(context.result, "pendingRetry");
      }
      return;
    }

    incrementPipelineMetric(context.result, status === "success" ? "saved" : "needsReview");
    if (status === "needs_review") {
      appendNeedsReviewEmailParseImprovementRequest(context, email, parsed.confidence);
    }
  });
}

export async function processIncomingEmail(context: EmailBatchContext, email: RawEmail) {
  const parsed = await parseIncomingEmail(context, email);
  if (parsed.kind !== "parsed") {
    if (parsed.kind === "failed") {
      const queuedRetry = await persistPendingRetryIncomingEmail(context, email, "parse_error");
      incrementPipelineMetric(context.result, "failed");
      if (queuedRetry) {
        incrementPipelineMetric(context.result, "pendingRetry");
      }
      return;
    }

    await persistSkippedIncomingEmail(context, email, parsed.kind);
    return;
  }

  await processParsedIncomingEmail(context, email, parsed.parsed);
}
