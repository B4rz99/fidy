import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { captureErrorEffect, captureWarningEffect } from "@/shared/effect/telemetry";
import { generateProcessedEmailId } from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { assertIsoDateTime } from "@/shared/types/assertions";
import {
  findDuplicateTransactionEffect,
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
        errorType: error instanceof Error ? error.message : "unknown",
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
      processedEmailId: input.processedEmailId,
      transactionId: input.transactionId,
      now: input.createdAt,
    })
  );
}

async function persistUnparsedIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail,
  kind: UnparsedIncomingEmailKind
) {
  const { createdAt, processedEmailId } = await createIncomingEmailPersistenceState(context, email);
  const shouldRetry = kind === "failed";
  const nextRetryAt = shouldRetry
    ? await context.runtime.runClockEffect(nextRetryAtEffect(0))
    : null;
  const row = buildUnparsedProcessedEmailRow({
    email,
    processedEmailId,
    createdAt,
    status: shouldRetry ? "pending_retry" : "skipped",
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
  incrementPipelineMetric(context.result, shouldRetry ? "failed" : "filtered");
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
  const duplicate = await lookupIncomingDuplicate(context, parsed);
  if (duplicate.kind === "failed") {
    incrementPipelineMetric(context.result, "failed");
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
    incrementPipelineMetric(context.result, "failed");
    return;
  }

  incrementPipelineMetric(context.result, status === "success" ? "saved" : "needsReview");
}

export async function processIncomingEmail(context: EmailBatchContext, email: RawEmail) {
  const parsed = await parseIncomingEmail(context, email);
  if (parsed.kind !== "parsed") {
    await persistUnparsedIncomingEmail(context, email, parsed.kind);
    return;
  }

  await processParsedIncomingEmail(context, email, parsed.parsed);
}
