import { Effect } from "effect";
import type { ProcessedEmailRow } from "@/features/email-capture/lib/repository";
import { getBuiltInCategoryId, isValidCategoryId } from "@/features/transactions/lib/categories";
import type { TransactionRow } from "@/features/transactions/lib/repository";
import type { AnyDb, SyncQueueEntry } from "@/shared/db";
import { fromPromise, fromThunk, makeAppTag, runWithService } from "@/shared/effect/runtime";
import { toIsoDateTime } from "@/shared/lib/format-date";
import {
  generateProcessedEmailId,
  generateSyncQueueId,
  generateTransactionId,
} from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { assertCopAmount, assertIsoDate, assertIsoDateTime } from "@/shared/types/assertions";
import type {
  CategoryId,
  IsoDateTime,
  ProcessedEmailId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import { computeNextRetryAt, isMaxRetriesReached } from "../lib/retry-backoff";
import type { RawEmail } from "../schema";
import type { LlmParsedTransaction } from "./llm-parser";

export type PipelineResult = {
  filtered: number;
  skippedDuplicate: number;
  skippedCrossSource: number;
  saved: number;
  failed: number;
  needsReview: number;
};

export type ProgressCallback = (progress: {
  total: number;
  completed: number;
  saved: number;
  failed: number;
  needsReview: number;
}) => void;

export type RetryResult = {
  retried: number;
  succeeded: number;
  permanentlyFailed: number;
};

type CaptureWarning = (
  name: "email_parse_exception" | "email_retry_parse_exception",
  tags: {
    provider: RawEmail["provider"] | ProcessedEmailRow["provider"];
    errorType: string;
  }
) => void | Promise<void>;

type CapturePipelineEvent = (input: {
  source: "email";
  batchSize: number;
  uniqueProviders: number;
  dedupedInBatch: number;
  skippedAlreadyProcessed: number;
  skippedCrossSource: number;
  saved: number;
  failed: number;
  needsReview: number;
}) => void | Promise<void>;

type CreateEmailPipelineServiceDeps = {
  readonly parseEmailApi: (body: string) => Promise<LlmParsedTransaction | null>;
  readonly lookupMerchantRule: (
    db: AnyDb,
    userId: UserId,
    merchantKey: string
  ) => Promise<CategoryId | null>;
  readonly findDuplicateTransaction: (
    db: AnyDb,
    userId: UserId,
    amount: LlmParsedTransaction["amount"],
    date: LlmParsedTransaction["date"],
    description: string
  ) => Promise<TransactionId | null>;
  readonly getProcessedExternalIds: (db: AnyDb, externalIds: string[]) => Promise<Set<string>>;
  readonly getPendingRetryEmails: (db: AnyDb) => Promise<readonly ProcessedEmailRow[]>;
  readonly insertProcessedEmail: (db: AnyDb, row: ProcessedEmailRow) => Promise<void>;
  readonly markForRetry: (
    db: AnyDb,
    id: ProcessedEmailId,
    retryCount: number,
    nextRetryAt: IsoDateTime
  ) => Promise<void>;
  readonly markPermanentlyFailed: (db: AnyDb, id: ProcessedEmailId) => Promise<void>;
  readonly markRetrySuccess: (
    db: AnyDb,
    id: ProcessedEmailId,
    status: "success" | "needs_review",
    transactionId: TransactionId,
    confidence: number
  ) => Promise<void>;
  readonly updateProcessedEmailStatus: (
    db: AnyDb,
    id: ProcessedEmailId,
    status: string,
    transactionId: TransactionId | null
  ) => Promise<void>;
  readonly insertTransaction: (db: AnyDb, row: TransactionRow) => void | Promise<void>;
  readonly enqueueSync: (db: AnyDb, input: SyncQueueEntry) => void | Promise<void>;
  readonly insertMerchantRule: (
    db: AnyDb,
    userId: UserId,
    merchantKey: string,
    categoryId: CategoryId,
    createdAt: IsoDateTime
  ) => Promise<void>;
  readonly trackTransactionCreated: (input: {
    type: LlmParsedTransaction["type"];
    category: string;
    source: "email";
  }) => void | Promise<void>;
  readonly captureError: (error: unknown) => void | Promise<void>;
  readonly captureWarning: CaptureWarning;
  readonly capturePipelineEvent: CapturePipelineEvent;
};

export type EmailPipelineService = {
  readonly processEmails: (
    db: AnyDb,
    userId: UserId,
    rawEmails: RawEmail[],
    onProgress?: ProgressCallback
  ) => Promise<PipelineResult>;
  readonly processRetries: (db: AnyDb, userId: UserId) => Promise<RetryResult>;
};

const EmailPipelineDeps = makeAppTag<CreateEmailPipelineServiceDeps>(
  "@/features/email-capture/EmailPipelineDeps"
);

function getTransactionSource(provider: RawEmail["provider"] | ProcessedEmailRow["provider"]) {
  return provider === "gmail" ? "email_gmail" : "email_outlook";
}

function getPersistedCategoryId(categoryId: string): CategoryId {
  return isValidCategoryId(categoryId) ? categoryId : getBuiltInCategoryId("other");
}

function getProgressSnapshot(
  total: number,
  completed: number,
  result: PipelineResult
): Parameters<ProgressCallback>[0] {
  return {
    total,
    completed,
    saved: result.saved,
    failed: result.failed,
    needsReview: result.needsReview,
  };
}

function parseBodyEffect(db: AnyDb, userId: UserId, body: string) {
  return Effect.gen(function* () {
    const { parseEmailApi, lookupMerchantRule } = yield* EmailPipelineDeps;
    const llmResult = yield* fromPromise(() => parseEmailApi(body));
    if (!llmResult) return null;

    const merchantKey = normalizeMerchant(llmResult.description);
    const cachedCategoryId = yield* fromPromise(() => lookupMerchantRule(db, userId, merchantKey));

    return cachedCategoryId
      ? { ...llmResult, categoryId: cachedCategoryId, confidence: 1.0 }
      : llmResult;
  });
}

function getProcessedExternalIdsEffect(db: AnyDb, externalIds: string[]) {
  return Effect.flatMap(EmailPipelineDeps, ({ getProcessedExternalIds }) =>
    fromPromise(() => getProcessedExternalIds(db, externalIds))
  );
}

function getPendingRetryEmailsEffect(db: AnyDb) {
  return Effect.flatMap(EmailPipelineDeps, ({ getPendingRetryEmails }) =>
    fromPromise(() => getPendingRetryEmails(db))
  );
}

function findDuplicateTransactionEffect(db: AnyDb, userId: UserId, parsed: LlmParsedTransaction) {
  return Effect.flatMap(EmailPipelineDeps, ({ findDuplicateTransaction }) =>
    fromPromise(() =>
      findDuplicateTransaction(db, userId, parsed.amount, parsed.date, parsed.description)
    )
  );
}

function insertProcessedEmailEffect(db: AnyDb, row: ProcessedEmailRow) {
  return Effect.flatMap(EmailPipelineDeps, ({ insertProcessedEmail }) =>
    fromPromise(() => insertProcessedEmail(db, row))
  );
}

function saveTransactionEffect(
  db: AnyDb,
  userId: UserId,
  validated: LlmParsedTransaction,
  email: RawEmail,
  status: "success" | "needs_review"
) {
  return Effect.gen(function* () {
    const { insertTransaction, enqueueSync, insertProcessedEmail, trackTransactionCreated } =
      yield* EmailPipelineDeps;
    const source = getTransactionSource(email.provider);
    const txId = generateTransactionId();
    const now = toIsoDateTime(new Date());
    const amount = validated.amount;
    const date = validated.date;
    const receivedAt = email.receivedAt;
    const categoryId = getPersistedCategoryId(validated.categoryId);

    assertCopAmount(amount);
    assertIsoDate(date);
    assertIsoDateTime(receivedAt);

    yield* fromThunk(() =>
      insertTransaction(db, {
        id: txId,
        userId,
        type: validated.type,
        amount,
        categoryId,
        description: validated.description,
        date,
        source,
        createdAt: now,
        updatedAt: now,
      })
    );

    yield* fromThunk(() =>
      enqueueSync(db, {
        id: generateSyncQueueId(),
        tableName: "transactions",
        rowId: txId,
        operation: "insert",
        createdAt: now,
      })
    );

    yield* fromPromise(() =>
      insertProcessedEmail(db, {
        id: generateProcessedEmailId(),
        externalId: email.externalId,
        provider: email.provider,
        status,
        failureReason: null,
        subject: email.subject,
        rawBodyPreview: email.body.slice(0, 500),
        receivedAt,
        transactionId: txId,
        confidence: validated.confidence,
        createdAt: now,
      })
    );

    if (status === "success") {
      yield* fromThunk(() =>
        trackTransactionCreated({
          type: validated.type,
          category: String(categoryId),
          source: "email",
        })
      );
    }

    return txId;
  });
}

function insertMerchantRuleEffect(
  db: AnyDb,
  userId: UserId,
  merchantKey: string,
  categoryId: CategoryId,
  createdAt: IsoDateTime
) {
  return Effect.flatMap(EmailPipelineDeps, ({ insertMerchantRule }) =>
    fromPromise(() => insertMerchantRule(db, userId, merchantKey, categoryId, createdAt))
  );
}

function captureErrorEffect(error: unknown) {
  return Effect.flatMap(EmailPipelineDeps, ({ captureError }) =>
    fromThunk(() => captureError(error))
  );
}

function captureWarningEffect(
  name: "email_parse_exception" | "email_retry_parse_exception",
  tags: {
    provider: RawEmail["provider"] | ProcessedEmailRow["provider"];
    errorType: string;
  }
) {
  return Effect.flatMap(EmailPipelineDeps, ({ captureWarning }) =>
    fromThunk(() => captureWarning(name, tags))
  );
}

function capturePipelineEventEffect(input: Parameters<CapturePipelineEvent>[0]) {
  return Effect.flatMap(EmailPipelineDeps, ({ capturePipelineEvent }) =>
    fromThunk(() => capturePipelineEvent(input))
  );
}

function markForRetryEffect(
  db: AnyDb,
  id: ProcessedEmailId,
  retryCount: number,
  nextRetryAt: IsoDateTime
) {
  return Effect.flatMap(EmailPipelineDeps, ({ markForRetry }) =>
    fromPromise(() => markForRetry(db, id, retryCount, nextRetryAt))
  );
}

function markPermanentlyFailedEffect(db: AnyDb, id: ProcessedEmailId) {
  return Effect.flatMap(EmailPipelineDeps, ({ markPermanentlyFailed }) =>
    fromPromise(() => markPermanentlyFailed(db, id))
  );
}

function markRetrySuccessEffect(
  db: AnyDb,
  id: ProcessedEmailId,
  status: "success" | "needs_review",
  transactionId: TransactionId,
  confidence: number
) {
  return Effect.flatMap(EmailPipelineDeps, ({ markRetrySuccess }) =>
    fromPromise(() => markRetrySuccess(db, id, status, transactionId, confidence))
  );
}

function updateProcessedEmailStatusEffect(
  db: AnyDb,
  id: ProcessedEmailId,
  status: string,
  transactionId: TransactionId | null
) {
  return Effect.flatMap(EmailPipelineDeps, ({ updateProcessedEmailStatus }) =>
    fromPromise(() => updateProcessedEmailStatus(db, id, status, transactionId))
  );
}

function saveRetryTransactionEffect(
  db: AnyDb,
  userId: UserId,
  parsed: LlmParsedTransaction,
  email: ProcessedEmailRow
) {
  return Effect.gen(function* () {
    const { insertTransaction, enqueueSync, insertMerchantRule, trackTransactionCreated } =
      yield* EmailPipelineDeps;
    const txId = generateTransactionId();
    const now = toIsoDateTime(new Date());
    const source = getTransactionSource(email.provider);
    const amount = parsed.amount;
    const date = parsed.date;
    const status: "success" | "needs_review" = parsed.confidence < 0.7 ? "needs_review" : "success";
    const categoryId = getPersistedCategoryId(parsed.categoryId);

    assertCopAmount(amount);
    assertIsoDate(date);

    yield* fromThunk(() =>
      insertTransaction(db, {
        id: txId,
        userId,
        type: parsed.type,
        amount,
        categoryId,
        description: parsed.description,
        date,
        source,
        createdAt: now,
        updatedAt: now,
      })
    );

    yield* fromThunk(() =>
      enqueueSync(db, {
        id: generateSyncQueueId(),
        tableName: "transactions",
        rowId: txId,
        operation: "insert",
        createdAt: now,
      })
    );

    if (status === "success") {
      const merchantKey = normalizeMerchant(parsed.description);
      yield* fromPromise(() => insertMerchantRule(db, userId, merchantKey, categoryId, now));
      yield* fromThunk(() =>
        trackTransactionCreated({
          type: parsed.type,
          category: String(categoryId),
          source: "email",
        })
      );
    }

    return { txId, status };
  });
}

export function createEmailPipelineService(
  deps: CreateEmailPipelineServiceDeps
): EmailPipelineService {
  const runEmailPipelineEffect = <A>(
    effect: Effect.Effect<A, unknown, CreateEmailPipelineServiceDeps>
  ): Promise<A> => runWithService(effect, EmailPipelineDeps, deps);

  return {
    async processEmails(db, userId, rawEmails, onProgress) {
      const uniqueEmails = Array.from(
        new Map(rawEmails.map((email) => [email.externalId, email])).values()
      );
      const dedupedInBatch = rawEmails.length - uniqueEmails.length;
      const allExternalIds = uniqueEmails.map((email) => email.externalId);
      const processedIds = await runEmailPipelineEffect(
        getProcessedExternalIdsEffect(db, allExternalIds)
      );
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
      onProgress?.(getProgressSnapshot(total, 0, result));

      // FP exemption: worker pool requires shared mutable state for real-time onProgress across workers.
      const Concurrency = 5;
      let completed = 0;
      let nextIdx = 0;

      async function worker(): Promise<void> {
        while (nextIdx < toProcess.length) {
          const email = toProcess[nextIdx++];
          if (email == null) break;

          let parsed: LlmParsedTransaction | null = null;
          let parseError = false;

          try {
            parsed = await runEmailPipelineEffect(parseBodyEffect(db, userId, email.body));
          } catch (err) {
            await runEmailPipelineEffect(
              captureWarningEffect("email_parse_exception", {
                provider: email.provider,
                errorType: err instanceof Error ? err.message : "unknown",
              })
            );
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
            await runEmailPipelineEffect(
              insertProcessedEmailEffect(db, {
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
              })
            );
            completed++;
            onProgress?.(getProgressSnapshot(total, completed, result));
            continue;
          }

          let existingTxId: TransactionId | null = null;
          try {
            existingTxId = await runEmailPipelineEffect(
              findDuplicateTransactionEffect(db, userId, parsed)
            );
          } catch (saveErr) {
            await runEmailPipelineEffect(captureErrorEffect(saveErr));
            result.failed++;
            completed++;
            onProgress?.(getProgressSnapshot(total, completed, result));
            continue;
          }

          if (existingTxId) {
            const receivedAt = email.receivedAt;
            assertIsoDateTime(receivedAt);
            await runEmailPipelineEffect(
              insertProcessedEmailEffect(db, {
                id: generateProcessedEmailId(),
                externalId: email.externalId,
                provider: email.provider,
                status: "skipped_duplicate",
                failureReason: null,
                subject: email.subject,
                rawBodyPreview: email.body.slice(0, 500),
                receivedAt,
                transactionId: existingTxId,
                confidence: parsed.confidence,
                createdAt: toIsoDateTime(new Date()),
              })
            );
            result.skippedCrossSource++;
            completed++;
            onProgress?.(getProgressSnapshot(total, completed, result));
            continue;
          }

          const status = parsed.confidence < 0.7 ? "needs_review" : "success";
          try {
            await runEmailPipelineEffect(saveTransactionEffect(db, userId, parsed, email, status));
            if (status === "needs_review") {
              result.needsReview++;
            } else {
              result.saved++;
            }
          } catch (saveErr) {
            await runEmailPipelineEffect(captureErrorEffect(saveErr));
            result.failed++;
            completed++;
            onProgress?.(getProgressSnapshot(total, completed, result));
            continue;
          }

          if (status === "success") {
            try {
              const merchantKey = normalizeMerchant(parsed.description);
              await runEmailPipelineEffect(
                insertMerchantRuleEffect(
                  db,
                  userId,
                  merchantKey,
                  getPersistedCategoryId(parsed.categoryId),
                  toIsoDateTime(new Date())
                )
              );
            } catch (ruleErr) {
              await runEmailPipelineEffect(captureErrorEffect(ruleErr));
            }
          }

          completed++;
          onProgress?.(getProgressSnapshot(total, completed, result));
        }
      }

      await Promise.all(Array.from({ length: Math.min(Concurrency, total) }, () => worker()));

      await runEmailPipelineEffect(
        capturePipelineEventEffect({
          source: "email",
          batchSize: rawEmails.length,
          uniqueProviders: new Set(rawEmails.map((email) => email.provider)).size,
          dedupedInBatch,
          skippedAlreadyProcessed,
          skippedCrossSource: result.skippedCrossSource,
          saved: result.saved,
          failed: result.failed,
          needsReview: result.needsReview,
        })
      );

      return result;
    },

    async processRetries(db, userId) {
      const result: RetryResult = { retried: 0, succeeded: 0, permanentlyFailed: 0 };
      const pendingEmails = await runEmailPipelineEffect(getPendingRetryEmailsEffect(db));

      for (const email of pendingEmails) {
        if (!email.rawBody) {
          await runEmailPipelineEffect(markPermanentlyFailedEffect(db, email.id));
          result.permanentlyFailed++;
          continue;
        }

        let parsed: LlmParsedTransaction | null = null;
        let parseError = false;

        try {
          parsed = await runEmailPipelineEffect(parseBodyEffect(db, userId, email.rawBody));
        } catch (err) {
          await runEmailPipelineEffect(
            captureWarningEffect("email_retry_parse_exception", {
              provider: email.provider,
              errorType: err instanceof Error ? err.message : "unknown",
            })
          );
          parseError = true;
        }

        if (parseError) {
          const nextCount = (email.retryCount ?? 0) + 1;
          if (isMaxRetriesReached(nextCount)) {
            await runEmailPipelineEffect(markPermanentlyFailedEffect(db, email.id));
            result.permanentlyFailed++;
          } else {
            await runEmailPipelineEffect(
              markForRetryEffect(db, email.id, nextCount, computeNextRetryAt(nextCount))
            );
            result.retried++;
          }
          continue;
        }

        if (!parsed) {
          await runEmailPipelineEffect(
            updateProcessedEmailStatusEffect(db, email.id, "skipped", null)
          );
          continue;
        }

        let existingTxId: TransactionId | null = null;
        try {
          existingTxId = await runEmailPipelineEffect(
            findDuplicateTransactionEffect(db, userId, parsed)
          );
        } catch (saveErr) {
          await runEmailPipelineEffect(captureErrorEffect(saveErr));
          const nextCount = (email.retryCount ?? 0) + 1;
          if (isMaxRetriesReached(nextCount)) {
            await runEmailPipelineEffect(markPermanentlyFailedEffect(db, email.id));
            result.permanentlyFailed++;
          } else {
            await runEmailPipelineEffect(
              markForRetryEffect(db, email.id, nextCount, computeNextRetryAt(nextCount))
            );
            result.retried++;
          }
          continue;
        }

        if (existingTxId) {
          await runEmailPipelineEffect(
            markRetrySuccessEffect(db, email.id, "success", existingTxId, parsed.confidence)
          );
          result.succeeded++;
          continue;
        }

        try {
          const { txId, status } = await runEmailPipelineEffect(
            saveRetryTransactionEffect(db, userId, parsed, email)
          );
          await runEmailPipelineEffect(
            markRetrySuccessEffect(db, email.id, status, txId, parsed.confidence)
          );
          result.succeeded++;
        } catch (saveErr) {
          await runEmailPipelineEffect(captureErrorEffect(saveErr));
          const nextCount = (email.retryCount ?? 0) + 1;
          if (isMaxRetriesReached(nextCount)) {
            await runEmailPipelineEffect(markPermanentlyFailedEffect(db, email.id));
            result.permanentlyFailed++;
          } else {
            await runEmailPipelineEffect(
              markForRetryEffect(db, email.id, nextCount, computeNextRetryAt(nextCount))
            );
            result.retried++;
          }
        }
      }

      return result;
    },
  };
}

export type ProcessEmails = EmailPipelineService["processEmails"];
export type ProcessRetries = EmailPipelineService["processRetries"];
