import {
  insertMerchantRule,
  lookupMerchantRule,
} from "@/features/email-capture/lib/merchant-rules";
import { classifyMerchantApi } from "@/features/email-capture/services/parse-email-api";
import { insertTransaction, isValidCategoryId } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  generateProcessedCaptureId,
  generateSyncQueueId,
  generateTransactionId,
  normalizeMerchant,
  toIsoDate,
  toIsoDateTime,
} from "@/shared/lib";
import type { CategoryId, CopAmount, TransactionId, UserId } from "@/shared/types/branded";
import { captureFingerprint, findDuplicateTransaction, isCaptureProcessed } from "../lib/dedup";
import { insertProcessedCapture } from "../lib/repository";
import type { ApplePayIntentData } from "../schema";

const inFlightFingerprints = new Set<string>();

export type ApplePayPipelineResult = {
  saved: boolean;
  skippedDuplicate: boolean;
  transactionId: string | null;
};

export async function processApplePayIntent(
  db: AnyDb,
  userId: string,
  intent: ApplePayIntentData
): Promise<ApplePayPipelineResult> {
  const amount = Math.round(intent.amount);
  const today = toIsoDate(new Date());
  const source = "apple_pay" as const;

  // Check fingerprint dedup
  const fingerprint = captureFingerprint(source, amount, today, intent.merchant);

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
    const existingTxId = await findDuplicateTransaction(db, userId, amount, today, intent.merchant);

    if (existingTxId) {
      const now = toIsoDateTime(new Date());
      await insertProcessedCapture(db, {
        id: generateProcessedCaptureId(),
        fingerprintHash: fingerprint,
        source,
        status: "skipped_duplicate",
        rawText: `${intent.merchant} $${intent.amount}`,
        transactionId: existingTxId as TransactionId,
        confidence: 1.0,
        receivedAt: now,
        createdAt: now,
      });
      return { saved: false, skippedDuplicate: true, transactionId: existingTxId };
    }

    // Check merchant rules cache
    const merchantKey = normalizeMerchant(intent.merchant);
    const cachedCategoryId = await lookupMerchantRule(db, userId, merchantKey);

    // If no cached category, classify via LLM
    const rawCategoryId = cachedCategoryId ?? (await classifyMerchantApi(intent.merchant));
    const categoryId = isValidCategoryId(rawCategoryId) ? rawCategoryId : "other";

    // Save transaction
    const txId = generateTransactionId();
    const now = toIsoDateTime(new Date());

    await insertTransaction(db, {
      id: txId,
      userId: userId as UserId,
      type: "expense",
      amount: amount as CopAmount,
      categoryId: categoryId as CategoryId,
      description: intent.merchant,
      date: today,
      source,
      createdAt: now,
      updatedAt: now,
    });

    await enqueueSync(db, {
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
      rawText: `${intent.merchant} $${intent.amount}`,
      transactionId: txId,
      confidence: 1.0,
      receivedAt: now,
      createdAt: now,
    });

    // Always cache merchant rule (Apple Pay data is high confidence)
    await insertMerchantRule(db, userId, merchantKey, categoryId, now);

    return { saved: true, skippedDuplicate: false, transactionId: txId };
  } finally {
    inFlightFingerprints.delete(fingerprint);
  }
}
