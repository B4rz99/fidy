import { insertMerchantRule } from "@/features/email-capture/merchant-rules.public";
import { recordAutomatedTransactionWithLocalLedger } from "@/infrastructure/local-ledger/record-transaction";
import {
  persistCommittedCaptureSourceEvent,
  persistCommittedCaptureSourceEventInTransaction,
  persistProcessedSourceEvent,
  persistReviewCandidateCapture,
} from "@/infrastructure/local-ledger/source-events";
import {
  capturePipelineEvent,
  generateTransactionId,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import { requireIsoDateTime } from "@/shared/types/assertions";
import { buildFailedFingerprint } from "./context";
import type {
  DuplicateCheckResult,
  NotificationPipelineResult,
  NotificationStageContext,
  NotificationStageMetrics,
  ParsedNotificationContext,
  ResolvedNotificationContext,
} from "./types";

async function cacheMerchantRuleIfEligible(context: ResolvedNotificationContext) {
  if (context.parsed.confidence < 0.7) {
    return;
  }

  if (context.parseMethod === "regex" && String(context.categoryId) === "other") {
    return;
  }

  await insertMerchantRule(
    context.db,
    context.userId,
    context.merchantKey,
    context.categoryId,
    context.now
  );
}

function resolveProcessedCaptureStatus(context: ResolvedNotificationContext) {
  return context.parsed.confidence < 0.7 ? "needs_review" : "success";
}

function trackNotificationPipeline(
  context: NotificationStageContext,
  metrics: NotificationStageMetrics
) {
  capturePipelineEvent({
    source: "notification",
    bankSource: context.source,
    parseMethod: context.parseMethod,
    ...metrics,
  });
}

export async function reportSkippedDuplicate(
  context: NotificationStageContext,
  transactionId: NotificationPipelineResult["transactionId"]
): Promise<NotificationPipelineResult> {
  trackNotificationPipeline(context, {
    saved: 0,
    skippedDuplicate: 1,
    parseFailed: 0,
  });

  return { saved: false, skippedDuplicate: true, transactionId };
}

function buildParseImprovementRequest(
  context: NotificationStageContext,
  input: { readonly status: "failed" | "needs_review"; readonly confidence: number | null }
) {
  return {
    source: context.source,
    status: input.status,
    confidence: input.confidence,
    parseMethod: context.parseMethod,
  };
}

async function saveTransactionRecord(context: ResolvedNotificationContext) {
  const transactionId = generateTransactionId();

  const result = await recordAutomatedTransactionWithLocalLedger({
    db: context.db,
    transactionId,
    now: context.now,
    command: {
      userId: context.userId,
      type: context.parsed.type,
      amount: context.parsed.amount,
      accountId: context.accountId,
      accountAttributionState: context.accountAttributionState,
      categoryId: context.categoryId,
      occurredOn: context.parsed.date,
      description: context.parsed.merchant,
      counterpartyName: context.parsed.merchant,
      source: "notification_capture",
    },
    afterRecord: (tx) => {
      persistCommittedCaptureSourceEventInTransaction(tx, {
        userId: context.userId,
        sourceFamily: context.source,
        sourceId: context.source,
        sourceEventId: context.fingerprint,
        status: "processed",
        failureReason: null,
        receivedAt: context.receivedAt,
        processedAt: context.now,
        transactionId,
        evidence: context.captureEvidence,
      });
    },
  });

  if (!result.success) {
    persistProcessedSourceEvent({
      db: context.db,
      userId: context.userId,
      sourceFamily: context.source,
      sourceId: context.source,
      sourceEventId: context.fingerprint,
      status: "failed",
      failureReason: `local_ledger_rejected:${result.error}`,
      receivedAt: context.receivedAt,
      processedAt: context.now,
    });
    throw new Error(`Local Ledger rejected notification transaction: ${result.error}`);
  }

  return transactionId;
}

async function trackSuccessfulNotification(context: ResolvedNotificationContext) {
  if (resolveProcessedCaptureStatus(context) !== "success") {
    return;
  }

  trackTransactionCreated({
    type: context.parsed.type,
    category: String(context.categoryId),
    source: "notification",
  });

  trackNotificationPipeline(context, {
    saved: 1,
    skippedDuplicate: 0,
    parseFailed: 0,
  });
}

export async function persistFailedNotification(
  context: NotificationStageContext
): Promise<NotificationPipelineResult> {
  const now = toIsoDateTime(new Date());
  persistProcessedSourceEvent({
    db: context.db,
    userId: context.userId,
    sourceFamily: context.source,
    sourceId: context.source,
    sourceEventId: buildFailedFingerprint(context.notification),
    status: "failed",
    failureReason: "parse_failed",
    receivedAt: context.receivedAt,
    processedAt: now,
  });
  trackNotificationPipeline(context, {
    saved: 0,
    skippedDuplicate: 0,
    parseFailed: 1,
  });

  return {
    saved: false,
    skippedDuplicate: false,
    transactionId: null,
    parseImprovementRequest: buildParseImprovementRequest(context, {
      status: "failed",
      confidence: null,
    }),
  };
}

export async function persistDuplicateNotification(
  context: ParsedNotificationContext,
  duplicate: DuplicateCheckResult
): Promise<NotificationPipelineResult> {
  if (duplicate.kind === "already_processed") {
    persistProcessedSourceEvent({
      db: context.db,
      userId: context.userId,
      sourceFamily: context.source,
      sourceId: context.source,
      sourceEventId: context.fingerprint,
      status: "processed",
      failureReason: "already_processed_duplicate",
      receivedAt: context.receivedAt,
      processedAt: toIsoDateTime(new Date()),
    });
    return reportSkippedDuplicate(context, null);
  }

  persistCommittedCaptureSourceEvent(context.db, {
    userId: context.userId,
    sourceFamily: context.source,
    sourceId: context.source,
    sourceEventId: context.fingerprint,
    status: "processed",
    failureReason: `duplicate:${duplicate.transactionId}`,
    receivedAt: context.receivedAt,
    processedAt: toIsoDateTime(new Date()),
    transactionId: duplicate.transactionId,
    evidence: context.captureEvidence,
  });

  return reportSkippedDuplicate(context, duplicate.transactionId);
}

export async function persistSuccessfulNotification(
  context: ResolvedNotificationContext
): Promise<NotificationPipelineResult> {
  if (resolveProcessedCaptureStatus(context) === "needs_review") {
    persistReviewCandidateCapture({
      db: context.db,
      userId: context.userId,
      sourceFamily: context.source,
      sourceId: context.source,
      sourceEventId: context.fingerprint,
      status: "needs_review",
      failureReason: "low_confidence",
      receivedAt: context.receivedAt,
      processedAt: context.now,
      candidate: {
        occurredAt: requireIsoDateTime(`${context.parsed.date}T00:00:00.000Z`),
        amount: context.parsed.amount,
        description: context.parsed.merchant,
        confidence: context.parsed.confidence,
      },
      evidence: context.captureEvidence,
    });

    trackNotificationPipeline(context, {
      saved: 0,
      skippedDuplicate: 0,
      parseFailed: 0,
    });

    return {
      saved: false,
      skippedDuplicate: false,
      transactionId: null,
      parseImprovementRequest: buildParseImprovementRequest(context, {
        status: "needs_review",
        confidence: context.parsed.confidence,
      }),
    };
  }

  const transactionId = await saveTransactionRecord(context);
  await cacheMerchantRuleIfEligible(context);
  await trackSuccessfulNotification(context);

  return { saved: true, skippedDuplicate: false, transactionId };
}
