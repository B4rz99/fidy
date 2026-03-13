import {
  insertMerchantRule,
  lookupMerchantRule,
} from "@/features/email-capture/lib/merchant-rules";
import { stripPii } from "@/features/email-capture/services/parse-email-api";
import { enqueueSync, insertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db/client";
import { toIsoDate } from "@/shared/lib/format-date";
import { generateId } from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
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
  transactionId: string | null;
};

export async function processNotification(
  db: AnyDb,
  userId: string,
  notification: NotificationData
): Promise<NotificationPipelineResult> {
  const notificationText = notification.bigText ?? notification.text ?? notification.title ?? "";
  const sanitizedText = stripPii(notificationText).slice(0, 500);
  const receivedAt = new Date(notification.timestamp).toISOString();
  const source = resolveSource(notification.packageName);
  const notificationDate = toIsoDate(new Date(notification.timestamp));

  // Try local regex parse first
  const localResult = parseNotificationLocally(notificationText);

  // If local parse fails, try cloud LLM
  const parsed = localResult
    ? { ...localResult, categoryId: "other", date: notificationDate, confidence: 0.8 }
    : await (async () => {
        const llm = await parseNotificationApi(sanitizedText);
        return llm
          ? {
              amountCents: llm.amountCents,
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
      id: generateId("pc"),
      fingerprintHash: `failed:${notification.packageName}:${notification.timestamp}`,
      source,
      status: "failed",
      rawText: sanitizedText,
      transactionId: null,
      confidence: null,
      receivedAt: receivedAt,
      createdAt: new Date().toISOString(),
    });
    return { saved: false, skippedDuplicate: false, transactionId: null };
  }

  // Check fingerprint dedup
  const fingerprint = captureFingerprint(source, parsed.amountCents, parsed.date, parsed.merchant);

  // Guard against concurrent processing of the same fingerprint.
  // Add synchronously before any await to close the race window.
  if (inFlightFingerprints.has(fingerprint)) {
    return { saved: false, skippedDuplicate: true, transactionId: null };
  }

  inFlightFingerprints.add(fingerprint);

  try {
    const alreadyProcessed = await isCaptureProcessed(db, fingerprint);
    if (alreadyProcessed) {
      return { saved: false, skippedDuplicate: true, transactionId: null };
    }
    // Cross-source dedup
    const existingTxId = await findDuplicateTransaction(
      db,
      userId,
      parsed.amountCents,
      parsed.date,
      parsed.merchant
    );

    if (existingTxId) {
      await insertProcessedCapture(db, {
        id: generateId("pc"),
        fingerprintHash: fingerprint,
        source,
        status: "skipped_duplicate",
        rawText: sanitizedText,
        transactionId: existingTxId,
        confidence: parsed.confidence,
        receivedAt: receivedAt,
        createdAt: new Date().toISOString(),
      });
      return { saved: false, skippedDuplicate: true, transactionId: existingTxId };
    }

    // Check merchant rules cache
    const merchantKey = normalizeMerchant(parsed.merchant);
    const cachedCategoryId = await lookupMerchantRule(db, userId, merchantKey);
    const finalCategoryId = cachedCategoryId ?? parsed.categoryId;

    // Save transaction
    const txId = generateId("tx");
    const now = new Date().toISOString();

    await insertTransaction(db, {
      id: txId,
      userId,
      type: parsed.type,
      amountCents: parsed.amountCents,
      categoryId: finalCategoryId,
      description: parsed.merchant,
      date: parsed.date,
      source,
      createdAt: now,
      updatedAt: now,
    });

    await enqueueSync(db, {
      id: generateId("sq"),
      tableName: "transactions",
      rowId: txId,
      operation: "insert",
      createdAt: now,
    });

    // Record in processedCaptures
    await insertProcessedCapture(db, {
      id: generateId("pc"),
      fingerprintHash: fingerprint,
      source,
      status: "success",
      rawText: sanitizedText,
      transactionId: txId,
      confidence: parsed.confidence,
      receivedAt: receivedAt,
      createdAt: now,
    });

    // Cache merchant rule if confidence >= 0.7
    if (parsed.confidence >= 0.7) {
      await insertMerchantRule(db, userId, merchantKey, finalCategoryId, now);
    }

    return { saved: true, skippedDuplicate: false, transactionId: txId };
  } finally {
    inFlightFingerprints.delete(fingerprint);
  }
}
