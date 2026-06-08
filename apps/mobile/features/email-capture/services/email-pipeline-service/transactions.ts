import { Effect } from "effect";
import {
  type CaptureEvidenceRow,
  materializeCaptureEvidenceRows,
} from "@/features/capture-evidence/write.public";
import type { FinancialAccountRow } from "@/features/financial-accounts/write.public";
import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { fromPromise } from "@/shared/effect/runtime";
import { toIsoDate } from "@/shared/lib/format-date";
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
import { buildAutomatedTransactionCommand } from "./transaction-recording";
import { trackSavedTransactionEffect } from "./transaction-tracking";
import type {
  CreateEmailPipelineServiceDeps,
  EmailTransactionContext,
  PersistedTransactionContext,
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

const ensureSyncWrite = (result: unknown, operation: string) => {
  if (result instanceof Promise) {
    throw new Error(`${operation} must be synchronous inside an Expo SQLite transaction`);
  }
};

function persistReviewCandidateBundleEffect(context: EmailTransactionContext) {
  return Effect.gen(function* () {
    const deps = yield* EmailPipelineDeps.tag;
    yield* fromPromise(() => commitReviewCandidate(context, deps));
  });
}

const isFutureDatedAutomatedCapture = (context: PersistedTransactionContext): boolean =>
  context.parsed.date > toIsoDate(new Date(context.now));

function persistTransactionBundleEffect(context: EmailTransactionContext) {
  return Effect.gen(function* () {
    const {
      buildEmailCaptureEvidence,
      insertProcessedEmailSourceEvent,
      recordAutomatedTransactionWithLocalLedger,
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
      receivedAt: requireIsoDateTime(context.email.receivedAt),
      processedAt: context.now,
      transactionId: context.txId,
      confidence: context.parsed.confidence,
      createdAt: context.now,
      updatedAt: context.now,
      deletedAt: null,
    };
    const evidenceRows = buildTransactionCaptureEvidenceRows(context, buildEmailCaptureEvidence);

    yield* fromPromise(async () => {
      const result = await recordAutomatedTransactionWithLocalLedger({
        db: context.db,
        command: buildAutomatedTransactionCommand(context),
        transactionId: context.txId,
        now: context.now,
        afterRecord: (tx) => {
          ensureSyncWrite(
            insertProcessedEmailSourceEvent(tx, processedSourceEventRow),
            "insertProcessedEmailSourceEvent"
          );
          ensureSyncWrite(saveCaptureEvidenceRows(tx, evidenceRows), "saveCaptureEvidenceRows");
        },
      });
      if (!result.success) throw new Error(`RecordTransaction rejected: ${result.error}`);
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
    if (context.status === "needs_review" || isFutureDatedAutomatedCapture(context)) {
      yield* persistReviewCandidateBundleEffect(context);
      return "needs_review" as const;
    }

    yield* persistTransactionBundleEffect(context);
    yield* trackSavedTransactionEffect({
      parsed: context.parsed,
      categoryId: context.categoryId,
    });
    return "success" as const;
  });
}

export function saveRetryTransactionEffect(input: SaveRetryTransactionInput) {
  return Effect.gen(function* () {
    const context = yield* createRetryTransactionContextEffect(input);
    if (context.status === "needs_review" || isFutureDatedAutomatedCapture(context)) {
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
