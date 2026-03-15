import { findDuplicateTransaction } from "@/features/capture-sources/lib/dedup";
import { enqueueSync, insertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db/client";
import { generateId } from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { captureError } from "@/shared/lib/sentry";
import { insertMerchantRule, lookupMerchantRule } from "../lib/merchant-rules";
import { getProcessedExternalIds, insertProcessedEmail } from "../lib/repository";
import type { RawEmail } from "../schema";
import type { LlmParsedTransaction } from "./llm-parser";
import { parseEmailApi } from "./parse-email-api";

export type PipelineResult = {
  filtered: number;
  skippedDuplicate: number;
  skippedCrossSource: number;
  saved: number;
  failed: number;
  needsReview: number;
};

async function parseEmail(
  db: AnyDb,
  userId: string,
  email: RawEmail
): Promise<LlmParsedTransaction | null> {
  const llmResult = await parseEmailApi(email.body);
  if (!llmResult) return null;

  // Check if we have a cached category for this merchant name
  const merchantKey = normalizeMerchant(llmResult.description);
  const cachedCategoryId = await lookupMerchantRule(db, userId, merchantKey);

  return cachedCategoryId
    ? { ...llmResult, categoryId: cachedCategoryId, confidence: 1.0 }
    : llmResult;
}

async function saveTransaction(
  db: AnyDb,
  userId: string,
  validated: LlmParsedTransaction,
  email: RawEmail,
  status: "success" | "needs_review"
): Promise<string> {
  const source = email.provider === "gmail" ? "email_gmail" : "email_outlook";
  const txId = generateId("tx");
  const now = new Date().toISOString();

  await insertTransaction(db, {
    id: txId,
    userId,
    type: validated.type,
    amountCents: validated.amountCents,
    categoryId: validated.categoryId,
    description: validated.description,
    date: validated.date,
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

  await insertProcessedEmail(db, {
    id: generateId("pe"),
    externalId: email.externalId,
    provider: email.provider,
    status,
    failureReason: null,
    subject: email.subject,
    rawBodyPreview: email.body.slice(0, 500),
    receivedAt: email.receivedAt,
    transactionId: txId,
    confidence: validated.confidence,
    createdAt: now,
  });

  return txId;
}

export type ProgressCallback = (progress: {
  total: number;
  completed: number;
  saved: number;
  failed: number;
}) => void;

export async function processEmails(
  db: AnyDb,
  userId: string,
  rawEmails: RawEmail[],
  onProgress?: ProgressCallback
): Promise<PipelineResult> {
  const result: PipelineResult = {
    filtered: 0,
    skippedDuplicate: 0,
    skippedCrossSource: 0,
    saved: 0,
    failed: 0,
    needsReview: 0,
  };

  const allExternalIds = rawEmails.map((e) => e.externalId);
  const processedIds = await getProcessedExternalIds(db, allExternalIds);

  // Skip already-processed emails (fetch stage already filtered by sender)
  const toProcess = rawEmails.filter((email) => {
    if (processedIds.has(email.externalId)) {
      result.skippedDuplicate++;
      return false;
    }
    return true;
  });

  let completed = 0;
  const total = toProcess.length;
  onProgress?.({ total, completed: 0, saved: 0, failed: 0 });

  // Worker pool: 5 concurrent workers, each grabs next email, parses + saves, reports progress 1 by 1
  const Concurrency = 5;
  let nextIdx = 0;

  async function worker(): Promise<void> {
    while (nextIdx < toProcess.length) {
      const email = toProcess[nextIdx++];

      let parsed: LlmParsedTransaction | null = null;
      let parseError = false;
      try {
        parsed = await parseEmail(db, userId, email);
      } catch (err) {
        console.warn(`[EmailCapture] parse threw for "${email.subject}":`, err);
        parseError = true;
      }

      if (!parsed) {
        const status = parseError ? "failed" : "skipped";
        const failureReason = parseError ? "parse_error" : null;

        if (parseError) {
          console.warn(`[EmailCapture] FAILED "${email.subject}" from ${email.from}: parse_error`);
          result.failed++;
        } else {
          result.filtered++;
        }

        await insertProcessedEmail(db, {
          id: generateId("pe"),
          externalId: email.externalId,
          provider: email.provider,
          status,
          failureReason,
          subject: email.subject,
          rawBodyPreview: email.body.slice(0, 500),
          receivedAt: email.receivedAt,
          transactionId: null,
          confidence: null,
          createdAt: new Date().toISOString(),
        });
        completed++;
        onProgress?.({ total, completed, saved: result.saved, failed: result.failed });
        continue;
      }

      // Cross-source dedup: skip if this transaction was already captured via notification/Apple Pay
      const existingTxId = await findDuplicateTransaction(
        db,
        userId,
        parsed.amountCents,
        parsed.date,
        parsed.description
      );
      if (existingTxId) {
        await insertProcessedEmail(db, {
          id: generateId("pe"),
          externalId: email.externalId,
          provider: email.provider,
          status: "skipped_duplicate",
          failureReason: null,
          subject: email.subject,
          rawBodyPreview: email.body.slice(0, 500),
          receivedAt: email.receivedAt,
          transactionId: existingTxId,
          confidence: parsed.confidence,
          createdAt: new Date().toISOString(),
        });
        result.skippedCrossSource++;
        completed++;
        onProgress?.({ total, completed, saved: result.saved, failed: result.failed });
        continue;
      }

      // parseEmailApi already validates via llmOutputSchema.safeParse
      if (parsed.confidence < 0.7) {
        try {
          await saveTransaction(db, userId, parsed, email, "needs_review");
          result.needsReview++;
        } catch (saveErr) {
          captureError(saveErr);
          result.failed++;
        }
        completed++;
        onProgress?.({ total, completed, saved: result.saved, failed: result.failed });
        continue;
      }

      try {
        await saveTransaction(db, userId, parsed, email, "success");
        result.saved++;
      } catch (saveErr) {
        captureError(saveErr);
        result.failed++;
        completed++;
        onProgress?.({ total, completed, saved: result.saved, failed: result.failed });
        continue;
      }

      try {
        const merchantKey = normalizeMerchant(parsed.description);
        await insertMerchantRule(
          db,
          userId,
          merchantKey,
          parsed.categoryId,
          new Date().toISOString()
        );
      } catch (ruleErr) {
        captureError(ruleErr);
      }
      completed++;
      onProgress?.({ total, completed, saved: result.saved, failed: result.failed });
    }
  }

  await Promise.all(Array.from({ length: Math.min(Concurrency, total) }, () => worker()));

  return result;
}
