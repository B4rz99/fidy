import {
  captureFingerprint,
  findDuplicateTransaction,
  isCaptureProcessed,
} from "@/features/capture-sources/lib/dedup";
import { parseNotificationLocally } from "@/features/capture-sources/lib/notification-parser";
import { insertProcessedCapture } from "@/features/capture-sources/lib/repository";
import type { NotificationData } from "@/features/capture-sources/schema";
import { resolveSource } from "@/features/capture-sources/schema";
import { parseNotificationApi } from "@/features/capture-sources/services/parse-notification-api";
import {
  insertMerchantRule,
  lookupMerchantRule,
} from "@/features/email-capture/lib/merchant-rules";
import { stripPii } from "@/features/email-capture/services/parse-email-api";
import { isValidCategoryId } from "@/features/transactions/lib/categories";
import { insertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  capturePipelineEvent,
  generateProcessedCaptureId,
  generateSyncQueueId,
  generateTransactionId,
  normalizeMerchant,
  toIsoDate,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import type { CategoryId, CopAmount, IsoDate, TransactionId, UserId } from "@/shared/types/branded";

/** In-flight fingerprints guard against concurrent duplicate processing. */
const inFlightFingerprints = new Set<string>();

export type NotificationPipelineResult = {
  saved: boolean;
  skippedDuplicate: boolean;
  transactionId: string | null;
};

export async function processNotification(
  db: AnyDb,
  userId: string,
  notification: NotificationData
): Promise<NotificationPipelineResult> {
  const notificationText = notification.bigText ?? notification.text;
  const sanitizedText = stripPii(notificationText).slice(0, 500);
  const receivedAt = toIsoDateTime(new Date(notification.timestamp));
  const source = resolveSource(notification.packageName);
  const notificationDate = toIsoDate(new Date(notification.timestamp));

  // Try local regex parse first
  const localResult = parseNotificationLocally(notificationText);

  // If local parse fails, try cloud LLM
  const parseMethod = localResult ? "regex" : "llm";
  const parsed = localResult
    ? { ...localResult, categoryId: "other", date: notificationDate, confidence: 0.8 }
    : await (async () => {
        const llm = await parseNotificationApi(sanitizedText);
        return llm
          ? {
              amount: llm.amount,
              merchant: llm.description,
              type: llm.type,
              categoryId: llm.categoryId,
              date: llm.date,
              confidence: llm.confidence,
            }
          : null;
      })();

  if (!parsed) {
    await insertProcessedCapture(db, {
      id: generateProcessedCaptureId(),
      fingerprintHash: `failed:${notification.packageName}:${notification.timestamp}`,
      source,
      status: "failed",
      rawText: sanitizedText,
      transactionId: null,
      confidence: null,
      receivedAt,
      createdAt: toIsoDateTime(new Date()),
    });
    capturePipelineEvent({
      source: "notification",
      bankSource: source,
      parseMethod,
      saved: 0,
      skippedDuplicate: 0,
      parseFailed: 1,
    });
    return { saved: false, skippedDuplicate: false, transactionId: null };
  }

  // Check fingerprint dedup
  const fingerprint = captureFingerprint(source, parsed.amount, parsed.date, parsed.merchant);

  // Guard against concurrent processing of the same fingerprint.
  // Add synchronously before any await to close the race window.
  if (inFlightFingerprints.has(fingerprint)) {
    capturePipelineEvent({
      source: "notification",
      bankSource: source,
      parseMethod,
      saved: 0,
      skippedDuplicate: 1,
      parseFailed: 0,
    });
    return { saved: false, skippedDuplicate: true, transactionId: null };
  }

  inFlightFingerprints.add(fingerprint);

  try {
    const alreadyProcessed = await isCaptureProcessed(db, fingerprint);
    if (alreadyProcessed) {
      capturePipelineEvent({
        source: "notification",
        bankSource: source,
        parseMethod,
        saved: 0,
        skippedDuplicate: 1,
        parseFailed: 0,
      });
      return { saved: false, skippedDuplicate: true, transactionId: null };
    }
    // Cross-source dedup
    const existingTxId = await findDuplicateTransaction(
      db,
      userId,
      parsed.amount,
      parsed.date,
      parsed.merchant
    );

    if (existingTxId) {
      await insertProcessedCapture(db, {
        id: generateProcessedCaptureId(),
        fingerprintHash: fingerprint,
        source,
        status: "skipped_duplicate",
        rawText: sanitizedText,
        transactionId: existingTxId as TransactionId,
        confidence: parsed.confidence,
        receivedAt,
        createdAt: toIsoDateTime(new Date()),
      });
      capturePipelineEvent({
        source: "notification",
        bankSource: source,
        parseMethod,
        saved: 0,
        skippedDuplicate: 1,
        parseFailed: 0,
      });
      return { saved: false, skippedDuplicate: true, transactionId: existingTxId };
    }

    // Check merchant rules cache
    const merchantKey = normalizeMerchant(parsed.merchant);
    const cachedCategoryId = await lookupMerchantRule(db, userId, merchantKey);
    const rawCategoryId = cachedCategoryId ?? parsed.categoryId;
    const finalCategoryId = isValidCategoryId(rawCategoryId) ? rawCategoryId : "other";

    // Save transaction
    const txId = generateTransactionId();
    const now = toIsoDateTime(new Date());

    insertTransaction(db, {
      id: txId,
      userId: userId as UserId,
      type: parsed.type,
      amount: parsed.amount as CopAmount,
      categoryId: finalCategoryId as CategoryId,
      description: parsed.merchant,
      date: parsed.date as IsoDate,
      source,
      createdAt: now,
      updatedAt: now,
    });

    enqueueSync(db, {
      id: generateSyncQueueId(),
      tableName: "transactions",
      rowId: txId,
      operation: "insert",
      createdAt: now,
    });

    // Record in processedCaptures
    await insertProcessedCapture(db, {
      id: generateProcessedCaptureId(),
      fingerprintHash: fingerprint,
      source,
      status: "success",
      rawText: sanitizedText,
      transactionId: txId,
      confidence: parsed.confidence,
      receivedAt,
      createdAt: now,
    });

    // Cache merchant rule if confidence >= 0.7
    if (parsed.confidence >= 0.7) {
      await insertMerchantRule(db, userId, merchantKey, finalCategoryId, now);
    }

    trackTransactionCreated({
      type: parsed.type,
      category: String(finalCategoryId),
      source: "notification",
    });

    capturePipelineEvent({
      source: "notification",
      bankSource: source,
      parseMethod,
      saved: 1,
      skippedDuplicate: 0,
      parseFailed: 0,
    });
    return { saved: true, skippedDuplicate: false, transactionId: txId };
  } finally {
    inFlightFingerprints.delete(fingerprint);
  }
}
