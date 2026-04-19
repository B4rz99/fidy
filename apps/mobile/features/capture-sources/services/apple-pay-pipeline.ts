import {
  insertMerchantRule,
  lookupMerchantRule,
} from "@/features/email-capture/merchant-rules.public";
import { classifyMerchantApi } from "@/features/email-capture/parsing.public";
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
import { assertCopAmount, assertUserId } from "@/shared/types/assertions";
import type { TransactionId } from "@/shared/types/branded";
import { captureFingerprint, findDuplicateTransaction, isCaptureProcessed } from "../lib/dedup";
import { insertProcessedCapture } from "../lib/repository";
import type { ApplePayIntentData } from "../schema";

const inFlightFingerprints = new Set<string>();

export type ApplePayPipelineResult = {
  saved: boolean;
  skippedDuplicate: boolean;
  transactionId: TransactionId | null;
};

export async function processApplePayIntent(
  db: AnyDb,
  userId: string,
  intent: ApplePayIntentData
): Promise<ApplePayPipelineResult> {
  assertUserId(userId);
  const amount = Math.round(intent.amount);
  assertCopAmount(amount);
  const today = toIsoDate(new Date());
  const source: "apple_pay" = "apple_pay";

  // Check fingerprint dedup
  const fingerprint = captureFingerprint(source, amount, today, intent.merchant);

  if (inFlightFingerprints.has(fingerprint)) {
    capturePipelineEvent({ source: "apple_pay", saved: 0, skippedDuplicate: 1 });
    return { saved: false, skippedDuplicate: true, transactionId: null };
  }

  inFlightFingerprints.add(fingerprint);

  try {
    const alreadyProcessed = await isCaptureProcessed(db, fingerprint);
    if (alreadyProcessed) {
      capturePipelineEvent({ source: "apple_pay", saved: 0, skippedDuplicate: 1 });
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
        transactionId: existingTxId,
        confidence: 1.0,
        receivedAt: now,
        createdAt: now,
      });
      capturePipelineEvent({ source: "apple_pay", saved: 0, skippedDuplicate: 1 });
      return { saved: false, skippedDuplicate: true, transactionId: existingTxId };
    }

    // Check merchant rules cache
    const merchantKey = normalizeMerchant(intent.merchant);
    const cachedCategoryId = await lookupMerchantRule(db, userId, merchantKey);

    // If no cached category, classify via LLM
    const rawCategoryId = cachedCategoryId ?? (await classifyMerchantApi(intent.merchant));
    const fallbackCategoryId = "other";
    if (!isValidCategoryId(fallbackCategoryId)) {
      throw new Error("Missing fallback category");
    }
    const categoryId = isValidCategoryId(rawCategoryId) ? rawCategoryId : fallbackCategoryId;

    // Save transaction
    const txId = generateTransactionId();
    const now = toIsoDateTime(new Date());
    const defaultAccount = ensureDefaultFinancialAccount(db, userId, { now });

    insertTransaction(db, {
      id: txId,
      userId,
      type: "expense",
      amount,
      categoryId,
      description: intent.merchant,
      date: today,
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
      rawText: `${intent.merchant} $${intent.amount}`,
      transactionId: txId,
      confidence: 1.0,
      receivedAt: now,
      createdAt: now,
    });

    // Always cache merchant rule (Apple Pay data is high confidence)
    await insertMerchantRule(db, userId, merchantKey, categoryId, now);

    trackTransactionCreated({
      type: "expense",
      category: String(categoryId),
      source: "apple_pay",
    });

    capturePipelineEvent({ source: "apple_pay", saved: 1, skippedDuplicate: 0 });
    return { saved: true, skippedDuplicate: false, transactionId: txId };
  } finally {
    inFlightFingerprints.delete(fingerprint);
  }
}
