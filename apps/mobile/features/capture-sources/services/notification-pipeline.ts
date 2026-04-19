import {
  insertMerchantRule,
  lookupMerchantRule,
} from "@/features/email-capture/merchant-rules.public";
import { stripPii } from "@/features/email-capture/parsing.public";
import { ensureDefaultFinancialAccount } from "@/features/financial-accounts";
import { insertTransaction, isValidCategoryId } from "@/features/transactions/write.public";
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
import { assertCopAmount, assertIsoDate, assertUserId } from "@/shared/types/assertions";
import type { TransactionId } from "@/shared/types/branded";
import { captureFingerprint, findDuplicateTransaction, isCaptureProcessed } from "../lib/dedup";
import { parseNotificationLocally } from "../lib/notification-parser";
import { insertProcessedCapture } from "../lib/repository";
import type { NotificationData } from "../schema";
import { resolveSource } from "../schema";
import { parseNotificationApi } from "./parse-notification-api";

/** In-flight fingerprints guard against concurrent duplicate processing. */
const inFlightFingerprints = new Set<string>();

export type NotificationPipelineResult = {
  saved: boolean;
  skippedDuplicate: boolean;
  transactionId: TransactionId | null;
};

export async function processNotification(
  db: AnyDb,
  userId: string,
  notification: NotificationData
): Promise<NotificationPipelineResult> {
  assertUserId(userId);
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

  assertCopAmount(parsed.amount);
  assertIsoDate(parsed.date);

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
        transactionId: existingTxId,
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
    const fallbackCategoryId = "other";
    if (!isValidCategoryId(fallbackCategoryId)) {
      throw new Error("Missing fallback category");
    }
    const finalCategoryId = isValidCategoryId(rawCategoryId) ? rawCategoryId : fallbackCategoryId;

    // Save transaction
    const txId = generateTransactionId();
    const now = toIsoDateTime(new Date());
    const defaultAccount = ensureDefaultFinancialAccount(db, userId, { now });

    insertTransaction(db, {
      id: txId,
      userId,
      type: parsed.type,
      amount: parsed.amount,
      categoryId: finalCategoryId,
      description: parsed.merchant,
      date: parsed.date,
      accountId: defaultAccount.id,
      accountAttributionState: "unresolved",
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
