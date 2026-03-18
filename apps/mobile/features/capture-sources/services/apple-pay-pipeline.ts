import {
  insertMerchantRule,
  lookupMerchantRule,
} from "@/features/email-capture/lib/merchant-rules";
import { classifyMerchantApi } from "@/features/email-capture/services/parse-email-api";
import { insertTransaction, isValidCategoryId } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import { generateId, normalizeMerchant, toIsoDate } from "@/shared/lib";
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
  const amountCents = Math.round(parseFloat((intent.amount * 100).toFixed(2)));
  const today = toIsoDate(new Date());
  const source = "apple_pay" as const;

  // Check fingerprint dedup
  const fingerprint = captureFingerprint(source, amountCents, today, intent.merchant);

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
      amountCents,
      today,
      intent.merchant
    );

    if (existingTxId) {
      const now = new Date().toISOString();
      await insertProcessedCapture(db, {
        id: generateId("pc"),
        fingerprintHash: fingerprint,
        source,
        status: "skipped_duplicate",
        rawText: `${intent.merchant} $${intent.amount}`,
        transactionId: existingTxId,
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
    const txId = generateId("tx");
    const now = new Date().toISOString();

    await insertTransaction(db, {
      id: txId,
      userId,
      type: "expense",
      amountCents,
      categoryId,
      description: intent.merchant,
      date: today,
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
