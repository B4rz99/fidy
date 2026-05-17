import { Effect } from "effect";
import {
  type CaptureEvidenceRow,
  materializeCaptureEvidenceRows,
} from "@/features/capture-evidence/write.public";
import type { FinancialAccountRow } from "@/features/financial-accounts/write.public";
import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { fromPromise } from "@/shared/effect/runtime";
// eslint-disable-next-line no-restricted-imports -- avoid shared/lib barrel pulling React Native into pure pipeline code
import { generateProcessedSourceEventId, generateTransactionId } from "@/shared/lib/generate-id";
import { assertIsoDateTime, requireIsoDateTime } from "@/shared/types/assertions";
import type { IsoDateTime } from "@/shared/types/branded";
import { commitReviewCandidate, persistReviewCandidateEffect } from "./review-candidate";
import { EmailPipelineDeps, ensureDefaultFinancialAccountEffect } from "./runtime";
import {
  persistSuccessfulRetryBundleEffect,
  persistSuccessfulRetrySideEffectsEffect,
} from "./retry-transaction-bundle";
import {
  assertParsedTransaction,
  getEmailSourceId,
  getPersistedCategoryId,
  getTransactionSource,
  resolveEmailStatus,
} from "./shared";
import {
  buildTransactionRow,
  defaultRecordTransaction,
  prepareRecordedTransaction,
} from "./transaction-recording";
import { trackSavedTransactionEffect } from "./transaction-tracking";
import type {
  CreateEmailPipelineServiceDeps,
  EmailTransactionContext,
  RetryTransactionContext,
  SaveRetryTransactionInput,
  SaveTransactionInput,
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
      processedSourceEventId: context.processedSourceEventId,
      createdAt: context.now,
      updatedAt: context.now,
    }
  );
}

const buildReviewProcessedSourceEventRow = (context: EmailTransactionContext) => ({
  id: context.processedSourceEventId,
  userId: context.userId,
  sourceFamily: "email",
  sourceId: getEmailSourceId(context.email),
  sourceEventId: context.email.externalId,
  status: "needs_review",
  failureReason: null,
  subject: context.email.subject,
  rawBodyPreview: context.email.body.slice(0, 500),
  rawBody: null,
  retryCount: 0,
  nextRetryAt: null,
  receivedAt: requireIsoDateTime(context.email.receivedAt),
  processedAt: context.now,
  transactionId: null,
  confidence: context.parsed.confidence,
  createdAt: context.now,
  updatedAt: context.now,
  deletedAt: null,
});

function persistReviewCandidateBundleEffect(context: EmailTransactionContext) {
  return Effect.gen(function* () {
    const deps = yield* EmailPipelineDeps.tag;
    const processedSourceEventRow = buildReviewProcessedSourceEventRow(context);

    yield* fromPromise(async () => {
      if ("transaction" in context.db && typeof context.db.transaction === "function") {
        let commitPromise:
          | ReturnType<typeof commitReviewCandidate>
          | undefined;
        context.db.transaction((tx) => {
          commitPromise = commitReviewCandidate({ ...context, db: tx }, deps);
          void deps.insertProcessedEmailSourceEvent(tx, processedSourceEventRow);
        });
        await commitPromise;
        return;
      }

      await commitReviewCandidate(context, deps);
      await deps.insertProcessedEmailSourceEvent(context.db, processedSourceEventRow);
    });
  });
}

function persistTransactionBundleEffect(context: EmailTransactionContext) {
  return Effect.gen(function* () {
    const {
      buildEmailCaptureEvidence,
      insertProcessedEmailSourceEvent,
      insertTransaction,
      recordTransaction = defaultRecordTransaction,
      saveCaptureEvidenceRows,
    } = yield* EmailPipelineDeps.tag;
    const processedSourceEventRow = {
      id: context.processedSourceEventId,
      userId: context.userId,
      sourceFamily: "email",
      sourceId: getEmailSourceId(context.email),
      sourceEventId: context.email.externalId,
      status: "processed",
      failureReason: null,
      subject: context.email.subject,
      rawBodyPreview: context.email.body.slice(0, 500),
      receivedAt: requireIsoDateTime(context.email.receivedAt),
      processedAt: context.now,
      transactionId: context.txId,
      confidence: context.parsed.confidence,
      createdAt: context.now,
      updatedAt: context.now,
      deletedAt: null,
    };
    const evidenceRows = buildTransactionCaptureEvidenceRows(context, buildEmailCaptureEvidence);
    const transaction = yield* fromPromise(() =>
      prepareRecordedTransaction(context, { recordTransaction })
    );

    yield* fromPromise(async () => {
      if ("transaction" in context.db && typeof context.db.transaction === "function") {
        context.db.transaction((tx) => {
          void insertTransaction(tx, buildTransactionRow(context, transaction));
          void insertProcessedEmailSourceEvent(tx, processedSourceEventRow);
          void saveCaptureEvidenceRows(tx, evidenceRows);
        });
        return;
      }

      await insertTransaction(context.db, buildTransactionRow(context, transaction));
      await insertProcessedEmailSourceEvent(context.db, processedSourceEventRow);
      await saveCaptureEvidenceRows(context.db, evidenceRows);
    });
  });
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
    processedSourceEventId: generateProcessedSourceEventId(),
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
    processedSourceEventId: input.processedSourceEventId,
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

    yield* persistSuccessfulRetryBundleEffect(context);
    yield* persistSuccessfulRetrySideEffectsEffect(context);
    return { txId: context.txId, status: context.status };
  });
}
