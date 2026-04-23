import {
  materializeCaptureEvidenceRows,
  saveCaptureEvidenceRows,
} from "@/features/capture-evidence";
import { insertMerchantRule } from "@/features/email-capture/merchant-rules.public";
import { insertTransaction } from "@/features/transactions/write.public";
import { enqueueSync } from "@/shared/db/enqueue-sync";
import {
  capturePipelineEvent,
  generateProcessedCaptureId,
  generateSyncQueueId,
  generateTransactionId,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import { insertProcessedCapture } from "../../lib/repository";
import { buildFailedFingerprint } from "./context";
import type {
  DuplicateCheckResult,
  NotificationPipelineResult,
  NotificationStageContext,
  NotificationStageMetrics,
  ParsedNotificationContext,
  PersistedCaptureOutcome,
  ResolvedNotificationContext,
} from "./types";

async function persistCaptureOutcome(
  context: NotificationStageContext,
  outcome: PersistedCaptureOutcome
) {
  const processedCaptureId = generateProcessedCaptureId();

  await insertProcessedCapture(context.db, {
    id: processedCaptureId,
    fingerprintHash: outcome.fingerprintHash,
    source: context.source,
    status: outcome.status,
    rawText: context.sanitizedText,
    transactionId: outcome.transactionId,
    confidence: outcome.confidence,
    receivedAt: context.receivedAt,
    createdAt: outcome.now,
  });

  await saveCaptureEvidenceRows(
    context.db,
    materializeCaptureEvidenceRows(context.captureEvidence, {
      userId: context.userId,
      transactionId: outcome.transactionId,
      processedEmailId: null,
      processedCaptureId,
      createdAt: outcome.now,
      updatedAt: outcome.now,
    })
  );
}

async function cacheMerchantRuleIfEligible(context: ResolvedNotificationContext) {
  if (context.parsed.confidence < 0.7) {
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

function saveTransactionRecord(context: ResolvedNotificationContext) {
  const transactionId = generateTransactionId();
  const syncQueueId = generateSyncQueueId();

  insertTransaction(context.db, {
    id: transactionId,
    userId: context.userId,
    type: context.parsed.type,
    amount: context.parsed.amount,
    categoryId: context.categoryId,
    description: context.parsed.merchant,
    date: context.parsed.date,
    accountId: context.accountId,
    accountAttributionState: context.accountAttributionState,
    source: context.source,
    createdAt: context.now,
    updatedAt: context.now,
  });

  enqueueSync(context.db, {
    id: syncQueueId,
    tableName: "transactions",
    rowId: transactionId,
    operation: "insert",
    createdAt: context.now,
  });

  return transactionId;
}

async function trackSuccessfulNotification(context: ResolvedNotificationContext) {
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

  await persistCaptureOutcome(context, {
    status: "failed",
    fingerprintHash: buildFailedFingerprint(context.notification),
    transactionId: null,
    confidence: null,
    now,
  });
  trackNotificationPipeline(context, {
    saved: 0,
    skippedDuplicate: 0,
    parseFailed: 1,
  });

  return { saved: false, skippedDuplicate: false, transactionId: null };
}

export async function persistDuplicateNotification(
  context: ParsedNotificationContext,
  duplicate: DuplicateCheckResult
): Promise<NotificationPipelineResult> {
  if (duplicate.kind === "already_processed") {
    return reportSkippedDuplicate(context, null);
  }

  await persistCaptureOutcome(context, {
    status: "skipped_duplicate",
    fingerprintHash: context.fingerprint,
    transactionId: duplicate.transactionId,
    confidence: context.parsed.confidence,
    now: toIsoDateTime(new Date()),
  });

  return reportSkippedDuplicate(context, duplicate.transactionId);
}

export async function persistSuccessfulNotification(
  context: ResolvedNotificationContext
): Promise<NotificationPipelineResult> {
  const transactionId = saveTransactionRecord(context);

  await persistCaptureOutcome(context, {
    status: "success",
    fingerprintHash: context.fingerprint,
    transactionId,
    confidence: context.parsed.confidence,
    now: context.now,
  });
  await cacheMerchantRuleIfEligible(context);
  await trackSuccessfulNotification(context);

  return { saved: true, skippedDuplicate: false, transactionId };
}
