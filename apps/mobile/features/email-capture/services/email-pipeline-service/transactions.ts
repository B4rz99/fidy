import { Effect } from "effect";
import {
  type CaptureEvidenceRow,
  materializeCaptureEvidenceRows,
} from "@/features/capture-evidence/public";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { TransactionRow } from "@/features/transactions/lib/repository";
import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { fromPromise, fromThunk } from "@/shared/effect/runtime";
import { generateProcessedEmailId, generateTransactionId } from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import {
  assertIsoDateTime,
  requireCopAmount,
  requireIsoDate,
  requireIsoDateTime,
} from "@/shared/types/assertions";
import type { IsoDateTime } from "@/shared/types/branded";
import {
  EmailPipelineDeps,
  ensureDefaultFinancialAccountEffect,
  insertMerchantRuleEffect,
} from "./runtime";
import {
  assertParsedTransaction,
  getPersistedCategoryId,
  getTransactionSource,
  resolveEmailStatus,
} from "./shared";
import type {
  EmailSaveStatus,
  EmailTransactionContext,
  PersistedTransactionContext,
  RetryTransactionContext,
  SaveRetryTransactionInput,
  SaveTransactionInput,
  TrackSavedTransactionInput,
  CreateEmailPipelineServiceDeps,
} from "./types";

function buildTransactionRow(context: PersistedTransactionContext): TransactionRow {
  return {
    id: context.txId,
    userId: context.userId,
    type: context.parsed.type,
    amount: requireCopAmount(context.parsed.amount),
    categoryId: context.categoryId,
    description: context.parsed.description,
    date: requireIsoDate(context.parsed.date),
    accountId: context.defaultAccount.id,
    accountAttributionState: "unresolved",
    source: context.source,
    createdAt: context.now,
    updatedAt: context.now,
  };
}

function persistTransactionRecordEffect(context: PersistedTransactionContext) {
  return Effect.gen(function* () {
    const { insertTransaction } = yield* EmailPipelineDeps.tag;
    yield* fromThunk(() => insertTransaction(context.db, buildTransactionRow(context)));
  });
}

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

function persistTransactionBundleEffect(context: EmailTransactionContext) {
  return Effect.gen(function* () {
    const {
      buildEmailCaptureEvidence,
      insertProcessedEmail,
      insertTransaction,
      saveCaptureEvidenceRows,
    } = yield* EmailPipelineDeps.tag;
    const transactionRow = buildTransactionRow(context);
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
          await insertTransaction(tx, transactionRow);
          await insertProcessedEmail(tx, processedEmailRow);
          await saveCaptureEvidenceRows(tx, evidenceRows);
        });
        return;
      }

      await insertTransaction(context.db, transactionRow);
      await insertProcessedEmail(context.db, processedEmailRow);
      await saveCaptureEvidenceRows(context.db, evidenceRows);
    });
  });
}

function trackSavedTransactionEffect(input: TrackSavedTransactionInput) {
  if (input.status !== "success") {
    return Effect.succeed(undefined);
  }

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
    if (context.status !== "success") return;

    yield* insertMerchantRuleEffect({
      db: context.db,
      userId: context.userId,
      merchantKey: normalizeMerchant(context.parsed.description),
      categoryId: context.categoryId,
      createdAt: context.now,
    });
    yield* trackSavedTransactionEffect({
      parsed: context.parsed,
      categoryId: context.categoryId,
      status: context.status,
    });
  });
}

export function saveTransactionEffect(input: SaveTransactionInput) {
  return Effect.gen(function* () {
    const context = yield* createEmailTransactionContextEffect(input);
    yield* persistTransactionBundleEffect(context);
    yield* trackSavedTransactionEffect({
      parsed: context.parsed,
      categoryId: context.categoryId,
      status: context.status,
    });
    return context.txId;
  });
}

export function saveRetryTransactionEffect(input: SaveRetryTransactionInput) {
  return Effect.gen(function* () {
    const context = yield* createRetryTransactionContextEffect(input);
    yield* persistTransactionRecordEffect(context);
    yield* persistSuccessfulRetrySideEffectsEffect(context);
    return { txId: context.txId, status: context.status as EmailSaveStatus };
  });
}
