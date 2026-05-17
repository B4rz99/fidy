import { findMatchingFinancialAccountId } from "@/features/account-suggestions/public";
import { buildApplePayCaptureEvidence } from "@/features/capture-evidence/public";
import {
  buildTransactionCandidate,
  validateCaptureCandidateForLocalLedger,
} from "@/features/capture-interpreter/public";
import {
  insertMerchantRule,
  lookupMerchantRule,
} from "@/features/email-capture/merchant-rules.public";
import { classifyMerchantApi } from "@/features/email-capture/parsing.public";
import { ensureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import { recordAutomatedTransactionWithLocalLedger } from "@/infrastructure/local-ledger/public";
import {
  recordCommittedCaptureSourceEventWithLocalLedger,
  recordCommittedCaptureSourceEventInTransactionWithLocalLedger,
  recordProcessedCaptureSourceEventWithLocalLedger,
} from "@/infrastructure/local-ledger/public";
import { CATEGORY_IDS } from "@/shared/categories";
import type { AnyDb } from "@/shared/db";
import {
  capturePipelineEvent,
  generateTransactionId,
  normalizeMerchant,
  toIsoDate,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import { assertCopAmount, assertUserId } from "@/shared/types/assertions";
import type { CategoryId, IsoDate, TransactionId } from "@/shared/types/branded";
import { captureFingerprint, findDuplicateTransaction, isCaptureProcessed } from "../lib/dedup";
import type { ApplePayIntentData } from "../schema";

const inFlightFingerprints = new Set<string>();

export type ApplePayPipelineResult = {
  saved: boolean;
  skippedDuplicate: boolean;
  transactionId: TransactionId | null;
};

type ApplePayCategoryResolutionInput = {
  readonly amount: number;
  readonly rawCategoryId: string;
  readonly merchant: string;
  readonly date: IsoDate;
};

function validateApplePayCategoryCandidate(
  input: ApplePayCategoryResolutionInput,
  categoryId: string
) {
  return validateCaptureCandidateForLocalLedger(
    buildTransactionCandidate({
      type: "expense",
      amount: input.amount,
      categoryId,
      description: input.merchant,
      date: input.date,
      confidence: 1.0,
    }),
    { validCategoryIds: CATEGORY_IDS }
  );
}

function requireAcceptedApplePayCategory(input: ApplePayCategoryResolutionInput): CategoryId {
  const fallbackValidation = validateApplePayCategoryCandidate(input, "other");

  if (fallbackValidation.kind !== "accepted") {
    throw new Error("Missing fallback category");
  }

  return fallbackValidation.transaction.categoryId;
}

function resolveApplePayCategoryId(input: {
  readonly amount: number;
  readonly rawCategoryId: string;
  readonly merchant: string;
  readonly date: IsoDate;
}): CategoryId {
  const validation = validateApplePayCategoryCandidate(input, input.rawCategoryId);

  if (validation.kind === "accepted") {
    return validation.transaction.categoryId;
  }

  return requireAcceptedApplePayCategory(input);
}

export async function processApplePayIntent(
  db: AnyDb,
  userId: string,
  intent: ApplePayIntentData
): Promise<ApplePayPipelineResult> {
  assertUserId(userId);
  const captureEvidence = buildApplePayCaptureEvidence(intent);
  const amount = Math.round(intent.amount);
  assertCopAmount(amount);
  const today = toIsoDate(new Date());
  const source = "apple_pay" as const;

  // Check fingerprint dedup
  const fingerprint = captureFingerprint({
    source,
    amount,
    date: today,
    merchant: intent.merchant,
  });

  if (inFlightFingerprints.has(fingerprint)) {
    capturePipelineEvent({ source: "apple_pay", saved: 0, skippedDuplicate: 1 });
    return { saved: false, skippedDuplicate: true, transactionId: null };
  }

  inFlightFingerprints.add(fingerprint);

  try {
    const alreadyProcessed = await isCaptureProcessed({
      db,
      userId,
      sourceFamily: source,
      sourceId: source,
      sourceEventId: fingerprint,
    });
    if (alreadyProcessed) {
      const now = toIsoDateTime(new Date());
      recordProcessedCaptureSourceEventWithLocalLedger({
        db,
        userId,
        sourceFamily: source,
        sourceId: source,
        sourceEventId: fingerprint,
        status: "duplicate",
        failureReason: null,
        receivedAt: now,
        processedAt: now,
      });
      capturePipelineEvent({ source: "apple_pay", saved: 0, skippedDuplicate: 1 });
      return { saved: false, skippedDuplicate: true, transactionId: null };
    }
    // Cross-source dedup
    const existingTxId = await findDuplicateTransaction({
      db,
      userId,
      amount,
      date: today,
      merchant: intent.merchant,
    });

    if (existingTxId) {
      const now = toIsoDateTime(new Date());
      recordCommittedCaptureSourceEventWithLocalLedger(db, {
        userId,
        sourceFamily: source,
        sourceId: source,
        sourceEventId: fingerprint,
        status: "duplicate",
        failureReason: null,
        receivedAt: now,
        processedAt: now,
        transactionId: existingTxId,
        evidence: captureEvidence,
      });
      capturePipelineEvent({ source: "apple_pay", saved: 0, skippedDuplicate: 1 });
      return { saved: false, skippedDuplicate: true, transactionId: existingTxId };
    }

    // Check merchant rules cache
    const merchantKey = normalizeMerchant(intent.merchant);
    const cachedCategoryId = await lookupMerchantRule(db, userId, merchantKey);

    // If no cached category, classify via LLM
    const rawCategoryId = cachedCategoryId ?? (await classifyMerchantApi(intent.merchant));
    const categoryId = resolveApplePayCategoryId({
      amount,
      rawCategoryId,
      merchant: intent.merchant,
      date: today,
    });

    // Save transaction
    const txId = generateTransactionId();
    const now = toIsoDateTime(new Date());
    const defaultAccount = ensureDefaultFinancialAccount(db, userId, { now });
    const matchedAccountId = findMatchingFinancialAccountId(db, userId, captureEvidence);

    const recordResult = await recordAutomatedTransactionWithLocalLedger({
      db,
      transactionId: txId,
      now,
      command: {
        userId,
        type: "expense",
        amount,
        categoryId,
        description: "",
        counterpartyName: intent.merchant,
        occurredOn: today,
        accountId: matchedAccountId ?? defaultAccount.id,
        accountAttributionState: matchedAccountId ? "inferred" : "unresolved",
        source: "apple_pay_capture",
      },
      afterRecord: (tx) => {
        recordCommittedCaptureSourceEventInTransactionWithLocalLedger(tx, {
          userId,
          sourceFamily: source,
          sourceId: source,
          sourceEventId: fingerprint,
          status: "processed",
          failureReason: null,
          receivedAt: now,
          processedAt: now,
          transactionId: txId,
          evidence: captureEvidence,
        });
      },
    });

    if (!recordResult.success) {
      recordProcessedCaptureSourceEventWithLocalLedger({
        db,
        userId,
        sourceFamily: source,
        sourceId: source,
        sourceEventId: fingerprint,
        status: "failed",
        failureReason: `local_ledger_rejected:${recordResult.error}`,
        receivedAt: now,
        processedAt: now,
      });
      throw new Error(`Local Ledger rejected Apple Pay transaction: ${recordResult.error}`);
    }

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
