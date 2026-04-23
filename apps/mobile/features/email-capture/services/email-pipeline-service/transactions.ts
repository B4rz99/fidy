import { Effect } from "effect";
import type { FinancialAccountRow } from "@/features/financial-accounts";
import type { TransactionRow } from "@/features/transactions/lib/repository";
import type { SyncQueueEntry } from "@/shared/db";
import { currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { fromPromise, fromThunk } from "@/shared/effect/runtime";
import {
  generateProcessedEmailId,
  generateSyncQueueId,
  generateTransactionId,
} from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import {
  assertIsoDateTime,
  requireCopAmount,
  requireIsoDate,
  requireIsoDateTime,
} from "@/shared/types/assertions";
import type { IsoDateTime, TransactionId } from "@/shared/types/branded";
import {
  EmailPipelineDeps,
  ensureDefaultFinancialAccountEffect,
  insertMerchantRuleEffect,
  saveEmailCaptureEvidenceEffect,
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

function buildTransactionSyncEntry(rowId: TransactionId, createdAt: IsoDateTime): SyncQueueEntry {
  return {
    id: generateSyncQueueId(),
    tableName: "transactions",
    rowId,
    operation: "insert" as const,
    createdAt,
  };
}

function persistTransactionRecordEffect(context: PersistedTransactionContext) {
  return Effect.gen(function* () {
    const { insertTransaction, enqueueSync } = yield* EmailPipelineDeps.tag;
    yield* fromThunk(() => insertTransaction(context.db, buildTransactionRow(context)));
    yield* fromThunk(() =>
      enqueueSync(context.db, buildTransactionSyncEntry(context.txId, context.now))
    );
  });
}

function persistProcessedEmailEffect(context: EmailTransactionContext) {
  const row = {
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

  return Effect.flatMap(EmailPipelineDeps.tag, ({ insertProcessedEmail }) =>
    fromPromise(() => insertProcessedEmail(context.db, row))
  );
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
    yield* persistTransactionRecordEffect(context);
    yield* persistProcessedEmailEffect(context);
    yield* saveEmailCaptureEvidenceEffect({
      db: context.db,
      userId: context.userId,
      from: context.email.from,
      processedEmailId: context.processedEmailId,
      transactionId: context.txId,
      now: context.now,
    });
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
