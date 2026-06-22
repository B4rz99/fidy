import { insertMerchantRule } from "@/features/email-capture/merchant-rules.public";
import { recordAutomatedTransactionWithLocalLedger } from "@/infrastructure/local-ledger/public";
import {
  recordCommittedCaptureSourceEventWithLocalLedger,
  recordCommittedCaptureSourceEventInTransactionWithLocalLedger,
  recordProcessedCaptureSourceEventWithLocalLedger,
  recordReviewCandidateCaptureWithLocalLedger,
} from "@/infrastructure/local-ledger/public";
import { capturePipelineEvent, generateTransactionId, trackTransactionCreated } from "@/shared/lib";
import { toIsoDate, toIsoDateTime } from "@/shared/lib/format-date";
import { requireIsoDate } from "@/shared/types/assertions";
import { buildFailedFingerprint } from "./context";
import type {
  DuplicateCheckResult,
  NotificationPipelineResult,
  NotificationStageContext,
  NotificationStageMetrics,
  ParsedNotificationContext,
  ResolvedNotificationContext,
  RetryableNotificationContext,
  ReviewableNotificationContext,
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
  return context.parsed.confidence < 0.7 || isFutureDatedCapture(context)
    ? "needs_review"
    : "success";
}

function isFutureDatedCapture(context: ResolvedNotificationContext) {
  return context.parsed.date > toIsoDate(new Date(context.now));
}

function resolveReviewFailureReason(context: ResolvedNotificationContext) {
  return isFutureDatedCapture(context) ? "future_dated" : "low_confidence";
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
    parseMethod: context.regexParseImprovementTemplate ? "regex" : context.parseMethod,
    ...(context.regexParseImprovementTemplate
      ? { parserTemplate: context.regexParseImprovementTemplate }
      : {}),
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
      description: "",
      counterpartyName: context.parsed.merchant,
      source: "notification_capture",
    },
    afterRecord: (tx) => {
      recordCommittedCaptureSourceEventInTransactionWithLocalLedger(tx, {
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
    recordProcessedCaptureSourceEventWithLocalLedger({
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
  recordProcessedCaptureSourceEventWithLocalLedger({
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

export async function persistReviewableNotification(
  context: ReviewableNotificationContext
): Promise<NotificationPipelineResult> {
  const now = toIsoDateTime(new Date());
  await recordReviewCandidateCaptureWithLocalLedger({
    db: context.db,
    userId: context.userId,
    sourceFamily: context.source,
    sourceId: context.source,
    sourceEventId: buildFailedFingerprint(context.notification),
    status: "needs_review",
    failureReason: "parse_needs_review",
    receivedAt: context.receivedAt,
    processedAt: now,
    candidate: {
      candidateKind: "unknown",
      occurredAt: null,
      amount: null,
      transactionType: null,
      categoryId: null,
      description: null,
      confidence: context.review.confidence,
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
      confidence: context.review.confidence,
    }),
  };
}

export async function persistRetryableNotification(
  context: RetryableNotificationContext
): Promise<NotificationPipelineResult> {
  const now = toIsoDateTime(new Date());
  recordProcessedCaptureSourceEventWithLocalLedger({
    db: context.db,
    userId: context.userId,
    sourceFamily: context.source,
    sourceId: context.source,
    sourceEventId: buildFailedFingerprint(context.notification),
    status: "pending_retry",
    failureReason: "ai_unavailable",
    receivedAt: context.receivedAt,
    processedAt: now,
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
  };
}

export async function persistDuplicateNotification(
  context: ParsedNotificationContext,
  duplicate: DuplicateCheckResult
): Promise<NotificationPipelineResult> {
  if (duplicate.kind === "already_processed") {
    recordProcessedCaptureSourceEventWithLocalLedger({
      db: context.db,
      userId: context.userId,
      sourceFamily: context.source,
      sourceId: context.source,
      sourceEventId: context.fingerprint,
      status: "duplicate",
      failureReason: null,
      receivedAt: context.receivedAt,
      processedAt: toIsoDateTime(new Date()),
    });
    return reportSkippedDuplicate(context, null);
  }

  recordCommittedCaptureSourceEventWithLocalLedger(context.db, {
    userId: context.userId,
    sourceFamily: context.source,
    sourceId: context.source,
    sourceEventId: context.fingerprint,
    status: "duplicate",
    failureReason: null,
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
    await recordReviewCandidateCaptureWithLocalLedger({
      db: context.db,
      userId: context.userId,
      sourceFamily: context.source,
      sourceId: context.source,
      sourceEventId: context.fingerprint,
      status: "needs_review",
      failureReason: resolveReviewFailureReason(context),
      receivedAt: context.receivedAt,
      processedAt: context.now,
      candidate: {
        occurredAt: requireIsoDate(context.parsed.date),
        amount: context.parsed.amount,
        transactionType: context.parsed.type,
        categoryId: context.categoryId,
        description: "",
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
  await Promise.all([cacheMerchantRuleIfEligible(context), trackSuccessfulNotification(context)]);

  return {
    saved: true,
    skippedDuplicate: false,
    transactionId,
    ...(context.regexParseImprovementTemplate
      ? {
          parseImprovementRequest: buildParseImprovementRequest(context, {
            status: "failed",
            confidence: null,
          }),
        }
      : {}),
  };
}
