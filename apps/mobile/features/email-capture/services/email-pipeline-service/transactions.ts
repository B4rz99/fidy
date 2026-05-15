import { Effect } from "effect";
import {
  type CaptureEvidenceRow,
  materializeCaptureEvidenceRows,
} from "@/features/capture-evidence/public";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { fromPromise, fromThunk } from "@/shared/effect/runtime";
import { generateProcessedEmailId, generateTransactionId } from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { assertIsoDateTime, requireIsoDateTime } from "@/shared/types/assertions";
import type { IsoDateTime } from "@/shared/types/branded";
import { commitReviewCandidate, persistReviewCandidateEffect } from "./review-candidate";
import {
  EmailPipelineDeps,
  ensureDefaultFinancialAccountEffect,
  insertMerchantRuleEffect,
} from "./runtime";
import {
  assertParsedTransaction,
  getParsedCounterpartyName,
  getPersistedCategoryId,
  getTransactionSource,
  resolveEmailStatus,
} from "./shared";
import {
  defaultRecordTransaction,
  persistTransactionRecordEffect,
  recordTransactionToDb,
} from "./transaction-recording";
import type {
  CreateEmailPipelineServiceDeps,
  EmailTransactionContext,
  ProcessedEmailRow,
  RetryTransactionContext,
  SaveRetryTransactionInput,
  SaveTransactionInput,
  TrackSavedTransactionInput,
} from "./types";

function buildTransactionCaptureEvidenceRows(
  context: EmailTransactionContext,
  buildEmailCaptureEvidence: CreateEmailPipelineServiceDeps["buildEmailCaptureEvidence"]
): readonly CaptureEvidenceRow[] {
  return materializeCaptureEvidenceRows(
    buildEmailCaptureEvidence({
      from: context.email.from,
      body: context.email.body,
      fromAccountHint: context.parsed.fromAccountHint,
      toAccountHint: context.parsed.toAccountHint,
      cardProductHint: context.parsed.cardProductHint,
      accountTypeHint: context.parsed.accountTypeHint,
      counterpartyHint: context.parsed.counterpartyHint,
    }),
    {
      userId: context.userId,
      transactionId: context.txId,
      processedEmailId: context.processedEmailId,
      processedCaptureId: null,
      createdAt: context.now,
      updatedAt: context.now,
    }
  );
}

const buildReviewProcessedEmailRow = (context: EmailTransactionContext): ProcessedEmailRow => ({
  id: context.processedEmailId,
  externalId: context.email.externalId,
  provider: context.email.provider,
  status: "needs_review",
  failureReason: null,
  subject: context.email.subject,
  rawBodyPreview: context.email.body.slice(0, 500),
  receivedAt: requireIsoDateTime(context.email.receivedAt),
  transactionId: null,
  confidence: context.parsed.confidence,
  createdAt: context.now,
});

function persistReviewCandidateBundleEffect(context: EmailTransactionContext) {
  return Effect.gen(function* () {
    const deps = yield* EmailPipelineDeps.tag;
    const processedEmailRow = buildReviewProcessedEmailRow(context);

    yield* fromPromise(async () => {
      if ("transaction" in context.db && typeof context.db.transaction === "function") {
        await context.db.transaction(async (tx) => {
          await commitReviewCandidate({ ...context, db: tx }, deps);
          await deps.insertProcessedEmail(tx, processedEmailRow);
        });
        return;
      }

      await commitReviewCandidate(context, deps);
      await deps.insertProcessedEmail(context.db, processedEmailRow);
    });
  });
}

function persistTransactionBundleEffect(context: EmailTransactionContext) {
  return Effect.gen(function* () {
    const {
      buildEmailCaptureEvidence,
      insertProcessedEmail,
      insertTransaction,
      recordTransaction = defaultRecordTransaction,
      saveCaptureEvidenceRows,
    } = yield* EmailPipelineDeps.tag;
    const processedEmailRow = {
      id: context.processedEmailId,
      externalId: context.email.externalId,
      provider: context.email.provider,
      status: context.status,
      failureReason: null,
      subject: context.email.subject,
      rawBodyPreview: context.email.body.slice(0, 500),
      receivedAt: requireIsoDateTime(context.email.receivedAt),
      transactionId: context.txId,
      confidence: context.parsed.confidence,
      createdAt: context.now,
    };
    const evidenceRows = buildTransactionCaptureEvidenceRows(context, buildEmailCaptureEvidence);

    yield* fromPromise(async () => {
      if ("transaction" in context.db && typeof context.db.transaction === "function") {
        await context.db.transaction(async (tx) => {
          await recordTransactionToDb(context, {
            insertTransaction,
            recordTransaction,
            db: tx,
          });
          await insertProcessedEmail(tx, processedEmailRow);
          await saveCaptureEvidenceRows(tx, evidenceRows);
        });
        return;
      }

      await recordTransactionToDb(context, {
        insertTransaction,
        recordTransaction,
        db: context.db,
      });
      await insertProcessedEmail(context.db, processedEmailRow);
      await saveCaptureEvidenceRows(context.db, evidenceRows);
    });
  });
}

function trackSavedTransactionEffect(input: TrackSavedTransactionInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ trackTransactionCreated }) =>
    fromThunk(() =>
      trackTransactionCreated({
        type: input.parsed.type,
        category: String(input.categoryId),
        source: "email",
      })
    )
  );
}

function createEmailTransactionContext(
  input: SaveTransactionInput,
  now: IsoDateTime,
  defaultAccount: FinancialAccountRow
): EmailTransactionContext {
  return {
    db: input.db,
    userId: input.userId,
    parsed: input.parsed,
    email: input.email,
    status: input.status,
    now,
    txId: generateTransactionId(),
    processedEmailId: generateProcessedEmailId(),
    categoryId: getPersistedCategoryId(input.parsed.categoryId),
    source: getTransactionSource(input.email.provider),
    defaultAccount,
  };
}

function createRetryTransactionContext(
  input: SaveRetryTransactionInput,
  now: IsoDateTime,
  defaultAccount: FinancialAccountRow
): RetryTransactionContext {
  return {
    db: input.db,
    userId: input.userId,
    parsed: input.parsed,
    email: input.email,
    status: resolveEmailStatus(input.parsed.confidence),
    now,
    txId: generateTransactionId(),
    categoryId: getPersistedCategoryId(input.parsed.categoryId),
    source: getTransactionSource(input.email.provider),
    defaultAccount,
  };
}

function createEmailTransactionContextEffect(input: SaveTransactionInput) {
  return Effect.gen(function* () {
    const now = yield* currentIsoDateTimeEffect;
    const defaultAccount = yield* ensureDefaultFinancialAccountEffect({
      db: input.db,
      userId: input.userId,
      now,
    });
    assertParsedTransaction(input.parsed);
    assertIsoDateTime(input.email.receivedAt);
    return createEmailTransactionContext(input, now, defaultAccount);
  });
}

function createRetryTransactionContextEffect(input: SaveRetryTransactionInput) {
  return Effect.gen(function* () {
    const now = yield* currentIsoDateTimeEffect;
    const defaultAccount = yield* ensureDefaultFinancialAccountEffect({
      db: input.db,
      userId: input.userId,
      now,
    });
    assertParsedTransaction(input.parsed);
    return createRetryTransactionContext(input, now, defaultAccount);
  });
}

function persistSuccessfulRetrySideEffectsEffect(context: RetryTransactionContext) {
  return Effect.gen(function* () {
    yield* insertMerchantRuleEffect({
      db: context.db,
      userId: context.userId,
      merchantKey: normalizeMerchant(getParsedCounterpartyName(context.parsed)),
      categoryId: context.categoryId,
      createdAt: context.now,
    });
    yield* trackSavedTransactionEffect({
      parsed: context.parsed,
      categoryId: context.categoryId,
    });
  });
}

export function saveTransactionEffect(input: SaveTransactionInput) {
  return Effect.gen(function* () {
    const context = yield* createEmailTransactionContextEffect(input);
    if (context.status === "needs_review") {
      yield* persistReviewCandidateBundleEffect(context);
      return context.txId;
    }

    yield* persistTransactionBundleEffect(context);
    yield* trackSavedTransactionEffect({
      parsed: context.parsed,
      categoryId: context.categoryId,
    });
    return context.txId;
  });
}

export function saveRetryTransactionEffect(input: SaveRetryTransactionInput) {
  return Effect.gen(function* () {
    const context = yield* createRetryTransactionContextEffect(input);
    if (context.status === "needs_review") {
      yield* persistReviewCandidateEffect({
        ...context,
      });
      return { txId: null, status: context.status };
    }

    yield* persistTransactionRecordEffect(context);
    yield* persistSuccessfulRetrySideEffectsEffect(context);
    return { txId: context.txId, status: context.status };
  });
}
