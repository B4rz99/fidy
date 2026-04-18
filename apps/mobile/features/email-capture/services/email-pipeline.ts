import { findDuplicateTransaction } from "@/features/capture-sources/dedup.public";
import {
  getBuiltInCategoryId,
  insertTransaction,
  isValidCategoryId,
} from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  captureError,
  capturePipelineEvent,
  captureWarning,
  generateProcessedEmailId,
  generateSyncQueueId,
  generateTransactionId,
  normalizeMerchant,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import { assertCopAmount, assertIsoDate, assertIsoDateTime } from "@/shared/types/assertions";
import type { UserId } from "@/shared/types/branded";
import { insertMerchantRule, lookupMerchantRule } from "../lib/merchant-rules";
import {
  getPendingRetryEmails,
  getProcessedExternalIds,
  insertProcessedEmail,
  markForRetry,
  markPermanentlyFailed,
  markRetrySuccess,
  updateProcessedEmailStatus,
} from "../lib/repository";
import { computeNextRetryAt, isMaxRetriesReached } from "../lib/retry-backoff";
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

async function parseBody(
  db: AnyDb,
  userId: UserId,
  body: string
): Promise<LlmParsedTransaction | null> {
  const llmResult = await parseEmailApi(body);
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
  userId: UserId,
  validated: LlmParsedTransaction,
  email: RawEmail,
  status: "success" | "needs_review"
): Promise<string> {
  const source = email.provider === "gmail" ? "email_gmail" : "email_outlook";
  const txId = generateTransactionId();
  const now = toIsoDateTime(new Date());
  const fallbackCategoryId = getBuiltInCategoryId("other");

  const categoryId = isValidCategoryId(validated.categoryId)
    ? validated.categoryId
    : fallbackCategoryId;
  assertCopAmount(validated.amount);
  assertIsoDate(validated.date);
  assertIsoDateTime(email.receivedAt);

  insertTransaction(db, {
    id: txId,
    userId,
    type: validated.type,
    amount: validated.amount,
    categoryId,
    description: validated.description,
    date: validated.date,
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

  await insertProcessedEmail(db, {
    id: generateProcessedEmailId(),
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

  if (status === "success") {
    trackTransactionCreated({
      type: validated.type,
      category: String(categoryId),
      source: "email",
    });
  }

  return txId;
}

export type ProgressCallback = (progress: {
  total: number;
  completed: number;
  saved: number;
  failed: number;
  needsReview: number;
}) => void;

export async function processEmails(
  db: AnyDb,
  userId: UserId,
  rawEmails: RawEmail[],
  onProgress?: ProgressCallback
): Promise<PipelineResult> {
  // Deduplicate by externalId within the batch (same account connected twice
  // or same email forwarded across providers produces duplicate entries)
  const uniqueEmails = Array.from(
    new Map(rawEmails.map((email) => [email.externalId, email])).values()
  );
  const dedupedInBatch = rawEmails.length - uniqueEmails.length;

  const allExternalIds = uniqueEmails.map((e) => e.externalId);
  const processedIds = await getProcessedExternalIds(db, allExternalIds);

  const toProcess = uniqueEmails.filter((email) => !processedIds.has(email.externalId));
  const skippedAlreadyProcessed = uniqueEmails.length - toProcess.length;

  const result: PipelineResult = {
    filtered: 0,
    skippedDuplicate: dedupedInBatch + skippedAlreadyProcessed,
    skippedCrossSource: 0,
    saved: 0,
    failed: 0,
    needsReview: 0,
  };

  const total = toProcess.length;
  onProgress?.({ total, completed: 0, saved: 0, failed: 0, needsReview: 0 });

  // FP exemption: worker pool requires shared mutable state for real-time onProgress across workers.
  const Concurrency = 5;
  let completed = 0;
  let nextIdx = 0;

  async function worker(): Promise<void> {
    while (nextIdx < toProcess.length) {
      const email = toProcess[nextIdx++];
      // noUncheckedIndexedAccess: email is always defined here (guarded by while condition)
      if (email == null) break;

      let parsed: LlmParsedTransaction | null = null;
      let parseError = false;
      try {
        parsed = await parseBody(db, userId, email.body);
      } catch (err) {
        captureWarning("email_parse_exception", {
          provider: email.provider,
          errorType: err instanceof Error ? err.message : "unknown",
        });
        parseError = true;
      }

      if (!parsed) {
        const status = parseError ? "pending_retry" : "skipped";
        const failureReason = parseError ? "parse_error" : null;

        if (parseError) {
          result.failed++;
        } else {
          result.filtered++;
        }

        assertIsoDateTime(email.receivedAt);
        await insertProcessedEmail(db, {
          id: generateProcessedEmailId(),
          externalId: email.externalId,
          provider: email.provider,
          status,
          failureReason,
          subject: email.subject,
          rawBodyPreview: email.body.slice(0, 500),
          receivedAt: email.receivedAt,
          transactionId: null,
          confidence: null,
          createdAt: toIsoDateTime(new Date()),
          ...(parseError
            ? {
                rawBody: email.body,
                retryCount: 0,
                nextRetryAt: computeNextRetryAt(0),
              }
            : {}),
        });
        completed++;
        onProgress?.({
          total,
          completed,
          saved: result.saved,
          failed: result.failed,
          needsReview: result.needsReview,
        });
        continue;
      }

      assertCopAmount(parsed.amount);
      assertIsoDate(parsed.date);
      assertIsoDateTime(email.receivedAt);

      // Cross-source dedup: skip if this transaction was already captured via notification/Apple Pay
      const existingTxId = await findDuplicateTransaction(
        db,
        userId,
        parsed.amount,
        parsed.date,
        parsed.description
      );
      if (existingTxId) {
        await insertProcessedEmail(db, {
          id: generateProcessedEmailId(),
          externalId: email.externalId,
          provider: email.provider,
          status: "skipped_duplicate",
          failureReason: null,
          subject: email.subject,
          rawBodyPreview: email.body.slice(0, 500),
          receivedAt: email.receivedAt,
          transactionId: existingTxId,
          confidence: parsed.confidence,
          createdAt: toIsoDateTime(new Date()),
        });
        result.skippedCrossSource++;
        completed++;
        onProgress?.({
          total,
          completed,
          saved: result.saved,
          failed: result.failed,
          needsReview: result.needsReview,
        });
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
        onProgress?.({
          total,
          completed,
          saved: result.saved,
          failed: result.failed,
          needsReview: result.needsReview,
        });
        continue;
      }

      try {
        await saveTransaction(db, userId, parsed, email, "success");
        result.saved++;
      } catch (saveErr) {
        captureError(saveErr);
        result.failed++;
        completed++;
        onProgress?.({
          total,
          completed,
          saved: result.saved,
          failed: result.failed,
          needsReview: result.needsReview,
        });
        continue;
      }

      try {
        const merchantKey = normalizeMerchant(parsed.description);
        const validatedCategoryId = isValidCategoryId(parsed.categoryId)
          ? parsed.categoryId
          : getBuiltInCategoryId("other");
        await insertMerchantRule(
          db,
          userId,
          merchantKey,
          validatedCategoryId,
          toIsoDateTime(new Date())
        );
      } catch (ruleErr) {
        captureError(ruleErr);
      }
      completed++;
      onProgress?.({
        total,
        completed,
        saved: result.saved,
        failed: result.failed,
        needsReview: result.needsReview,
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(Concurrency, total) }, () => worker()));

  const uniqueProviders = new Set(rawEmails.map((e) => e.provider)).size;
  capturePipelineEvent({
    source: "email",
    batchSize: rawEmails.length,
    uniqueProviders,
    dedupedInBatch,
    skippedAlreadyProcessed,
    skippedCrossSource: result.skippedCrossSource,
    saved: result.saved,
    failed: result.failed,
    needsReview: result.needsReview,
  });

  return result;
}

export type ProcessEmails = typeof processEmails;

export type RetryResult = {
  retried: number;
  succeeded: number;
  permanentlyFailed: number;
};

export async function processRetries(db: AnyDb, userId: UserId): Promise<RetryResult> {
  const result: RetryResult = { retried: 0, succeeded: 0, permanentlyFailed: 0 };
  const pendingEmails = await getPendingRetryEmails(db);

  for (const email of pendingEmails) {
    if (!email.rawBody) {
      await markPermanentlyFailed(db, email.id);
      result.permanentlyFailed++;
      continue;
    }

    let parsed: LlmParsedTransaction | null = null;
    let parseError = false;

    try {
      parsed = await parseBody(db, userId, email.rawBody);
    } catch (err) {
      captureWarning("email_retry_parse_exception", {
        provider: email.provider,
        errorType: err instanceof Error ? err.message : "unknown",
      });
      parseError = true;
    }

    if (parseError) {
      const nextCount = email.retryCount + 1;
      if (isMaxRetriesReached(nextCount)) {
        await markPermanentlyFailed(db, email.id);
        result.permanentlyFailed++;
      } else {
        await markForRetry(db, email.id, nextCount, computeNextRetryAt(nextCount));
        result.retried++;
      }
      continue;
    }

    if (!parsed) {
      await updateProcessedEmailStatus(db, email.id, "skipped", null);
      continue;
    }

    assertCopAmount(parsed.amount);
    assertIsoDate(parsed.date);

    // Cross-source dedup: skip if this transaction was already captured via another source
    const existingTxId = await findDuplicateTransaction(
      db,
      userId,
      parsed.amount,
      parsed.date,
      parsed.description
    );
    if (existingTxId) {
      await markRetrySuccess(db, email.id, "success", existingTxId, parsed.confidence);
      result.succeeded++;
      continue;
    }

    // Save retry transaction
    try {
      const txId = generateTransactionId();
      const now = toIsoDateTime(new Date());
      const source = email.provider === "gmail" ? "email_gmail" : "email_outlook";
      const status = parsed.confidence < 0.7 ? "needs_review" : "success";
      const fallbackCategoryId = getBuiltInCategoryId("other");
      const retryCategoryId = isValidCategoryId(parsed.categoryId)
        ? parsed.categoryId
        : fallbackCategoryId;

      insertTransaction(db, {
        id: txId,
        userId,
        type: parsed.type,
        amount: parsed.amount,
        categoryId: retryCategoryId,
        description: parsed.description,
        date: parsed.date,
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

      if (status === "success") {
        const merchantKey = normalizeMerchant(parsed.description);
        await insertMerchantRule(db, userId, merchantKey, retryCategoryId, now);
        trackTransactionCreated({
          type: parsed.type,
          category: String(retryCategoryId),
          source: "email",
        });
      }

      await markRetrySuccess(db, email.id, status, txId, parsed.confidence);
      result.succeeded++;
    } catch (saveErr) {
      captureError(saveErr);
      const nextCount = email.retryCount + 1;
      if (isMaxRetriesReached(nextCount)) {
        await markPermanentlyFailed(db, email.id);
        result.permanentlyFailed++;
      } else {
        await markForRetry(db, email.id, nextCount, computeNextRetryAt(nextCount));
        result.retried++;
      }
    }
  }

  return result;
}

export type ProcessRetries = typeof processRetries;
