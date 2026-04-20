import { Effect } from "effect";
import type { CaptureEvidenceRow, CaptureEvidenceSeed } from "@/features/capture-evidence";
import { materializeCaptureEvidenceRows } from "@/features/capture-evidence";
import type { ProcessedEmailRow } from "@/features/email-capture/lib/repository";
import type { FinancialAccountRow } from "@/features/financial-accounts";
import { getBuiltInCategoryId, isValidCategoryId } from "@/features/transactions/lib/categories";
import type { TransactionRow } from "@/features/transactions/lib/repository";
import type { AnyDb, SyncQueueEntry } from "@/shared/db";
import {
  type AppClock,
  bindAppClock,
  currentDateEffect,
  currentIsoDateTimeEffect,
} from "@/shared/effect/clock";
import { fromPromise, fromThunk, makeAppService } from "@/shared/effect/runtime";
import {
  type AppTelemetry,
  bindAppTelemetry,
  captureErrorEffect,
  capturePipelineEventEffect,
  captureWarningEffect,
} from "@/shared/effect/telemetry";
import {
  generateProcessedEmailId,
  generateSyncQueueId,
  generateTransactionId,
} from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import {
  assertCopAmount,
  assertIsoDate,
  assertIsoDateTime,
  requireCopAmount,
  requireIsoDate,
  requireIsoDateTime,
} from "@/shared/types/assertions";
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
  readonly buildEmailCaptureEvidence: (input: { from: string }) => readonly CaptureEvidenceSeed[];
  readonly saveCaptureEvidenceRows: (
    db: AnyDb,
    rows: readonly CaptureEvidenceRow[]
  ) => void | Promise<void>;
  readonly linkCaptureEvidenceToTransaction: (
    db: AnyDb,
    processedEmailId: ProcessedEmailId,
    transactionId: TransactionId,
    updatedAt: IsoDateTime
  ) => void | Promise<void>;
  readonly ensureDefaultFinancialAccount: (
    db: AnyDb,
    userId: UserId,
    options?: { now?: IsoDateTime }
  ) => FinancialAccountRow;
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
  readonly clock?: AppClock;
  readonly telemetry?: AppTelemetry;
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

type EmailSaveStatus = "success" | "needs_review";

type PipelineRuntime = {
  readonly runClockEffect: <A>(effect: Effect.Effect<A, unknown, AppClock>) => Promise<A>;
  readonly runTelemetryEffect: <A>(effect: Effect.Effect<A, unknown, AppTelemetry>) => Promise<A>;
  readonly runEmailEffect: <A>(
    effect: Effect.Effect<A, unknown, CreateEmailPipelineServiceDeps>
  ) => Promise<A>;
  readonly runEmailWithClock: <A>(
    effect: Effect.Effect<A, unknown, CreateEmailPipelineServiceDeps | AppClock>
  ) => Promise<A>;
};

type CaptureEvidenceRowsInput = {
  readonly userId: UserId;
  readonly from: string;
  readonly processedEmailId: ProcessedEmailId;
  readonly transactionId: TransactionId | null;
  readonly now: IsoDateTime;
  readonly buildEmailCaptureEvidence: (input: { from: string }) => readonly CaptureEvidenceSeed[];
};

type CaptureEvidenceSaveInput = Omit<CaptureEvidenceRowsInput, "buildEmailCaptureEvidence"> & {
  readonly db: AnyDb;
};

type LinkCaptureEvidenceInput = {
  readonly db: AnyDb;
  readonly processedEmailId: ProcessedEmailId;
  readonly transactionId: TransactionId;
  readonly updatedAt: IsoDateTime;
};

type MerchantRuleEffectInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly merchantKey: string;
  readonly categoryId: CategoryId;
  readonly createdAt: IsoDateTime;
};

type RetryScheduleEffectInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly retryCount: number;
  readonly nextRetryAt: IsoDateTime;
};

type RetrySuccessEffectInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly status: EmailSaveStatus;
  readonly transactionId: TransactionId;
  readonly confidence: number;
};

type ProcessedEmailStatusEffectInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly status: string;
  readonly transactionId: TransactionId | null;
};

type DefaultAccountInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly now: IsoDateTime;
};

type SaveTransactionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly parsed: LlmParsedTransaction;
  readonly email: RawEmail;
  readonly status: EmailSaveStatus;
};

type SaveRetryTransactionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly parsed: LlmParsedTransaction;
  readonly email: ProcessedEmailRow;
};

type PersistedTransactionContext = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly parsed: LlmParsedTransaction;
  readonly categoryId: CategoryId;
  readonly source: ReturnType<typeof getTransactionSource>;
  readonly now: IsoDateTime;
  readonly txId: TransactionId;
  readonly defaultAccount: FinancialAccountRow;
};

type EmailTransactionContext = PersistedTransactionContext & {
  readonly email: RawEmail;
  readonly status: EmailSaveStatus;
  readonly processedEmailId: ProcessedEmailId;
};

type RetryTransactionContext = PersistedTransactionContext & {
  readonly email: ProcessedEmailRow;
  readonly status: EmailSaveStatus;
};

type ProcessEmailsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly rawEmails: RawEmail[];
  readonly onProgress?: ProgressCallback;
};

type ProcessRetriesInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
};

type EmailBatchPlan = {
  readonly toProcess: RawEmail[];
  readonly dedupedInBatch: number;
  readonly skippedAlreadyProcessed: number;
  readonly result: PipelineResult;
  readonly total: number;
};

type EmailBatchContext = {
  readonly runtime: PipelineRuntime;
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly result: PipelineResult;
  readonly total: number;
  readonly onProgress?: ProgressCallback;
  completed: number;
};

type RetryBatchContext = {
  readonly runtime: PipelineRuntime;
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly result: RetryResult;
};

type EmailQueue = {
  readonly emails: RawEmail[];
  nextIdx: number;
};

type IncomingParseOutcome =
  | { readonly kind: "parsed"; readonly parsed: LlmParsedTransaction }
  | { readonly kind: "filtered" }
  | { readonly kind: "failed" };

type DuplicateLookupOutcome =
  | { readonly kind: "new" }
  | { readonly kind: "duplicate"; readonly transactionId: TransactionId }
  | { readonly kind: "failed" };

type RetryParseOutcome =
  | { readonly kind: "parsed"; readonly parsed: LlmParsedTransaction }
  | { readonly kind: "retry" }
  | { readonly kind: "skipped" };

type RetryDuplicateOutcome =
  | { readonly kind: "new" }
  | { readonly kind: "duplicate"; readonly transactionId: TransactionId }
  | { readonly kind: "retry" };

type UnparsedIncomingEmailKind = Exclude<IncomingParseOutcome["kind"], "parsed">;
type EmailMetric = "filtered" | "skippedCrossSource" | "saved" | "failed" | "needsReview";

type UnparsedProcessedEmailRowInput = {
  readonly email: RawEmail;
  readonly processedEmailId: ProcessedEmailId;
  readonly createdAt: IsoDateTime;
  readonly status: "pending_retry" | "skipped";
  readonly nextRetryAt: IsoDateTime | null;
};

type DuplicateProcessedEmailRowInput = {
  readonly email: RawEmail;
  readonly processedEmailId: ProcessedEmailId;
  readonly transactionId: TransactionId;
  readonly confidence: number;
  readonly createdAt: IsoDateTime;
};

type TrackSavedTransactionInput = {
  readonly parsed: LlmParsedTransaction;
  readonly categoryId: CategoryId;
  readonly status: EmailSaveStatus;
};

type IncomingEmailPersistenceInput = {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly row: ProcessedEmailRow;
  readonly processedEmailId: ProcessedEmailId;
  readonly transactionId: TransactionId | null;
  readonly createdAt: IsoDateTime;
};

const EmailPipelineDeps = makeAppService<CreateEmailPipelineServiceDeps>(
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
    const { parseEmailApi, lookupMerchantRule } = yield* EmailPipelineDeps.tag;
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
  return Effect.flatMap(EmailPipelineDeps.tag, ({ getProcessedExternalIds }) =>
    fromPromise(() => getProcessedExternalIds(db, externalIds))
  );
}

function getPendingRetryEmailsEffect(db: AnyDb) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ getPendingRetryEmails }) =>
    fromPromise(() => getPendingRetryEmails(db))
  );
}

function findDuplicateTransactionEffect(db: AnyDb, userId: UserId, parsed: LlmParsedTransaction) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ findDuplicateTransaction }) =>
    fromPromise(() =>
      findDuplicateTransaction(db, userId, parsed.amount, parsed.date, parsed.description)
    )
  );
}

function insertProcessedEmailEffect(db: AnyDb, row: ProcessedEmailRow) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ insertProcessedEmail }) =>
    fromPromise(() => insertProcessedEmail(db, row))
  );
}

function buildEmailCaptureEvidenceRows(input: CaptureEvidenceRowsInput) {
  return materializeCaptureEvidenceRows(input.buildEmailCaptureEvidence({ from: input.from }), {
    userId: input.userId,
    transactionId: input.transactionId,
    processedEmailId: input.processedEmailId,
    processedCaptureId: null,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

function saveCaptureEvidenceRowsEffect(db: AnyDb, rows: readonly CaptureEvidenceRow[]) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ saveCaptureEvidenceRows }) =>
    fromThunk(() => saveCaptureEvidenceRows(db, rows))
  );
}

function saveEmailCaptureEvidenceEffect(input: CaptureEvidenceSaveInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ buildEmailCaptureEvidence }) =>
    saveCaptureEvidenceRowsEffect(
      input.db,
      buildEmailCaptureEvidenceRows({
        userId: input.userId,
        from: input.from,
        processedEmailId: input.processedEmailId,
        transactionId: input.transactionId,
        now: input.now,
        buildEmailCaptureEvidence,
      })
    )
  );
}

function linkCaptureEvidenceToTransactionEffect(input: LinkCaptureEvidenceInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ linkCaptureEvidenceToTransaction }) =>
    fromThunk(() =>
      linkCaptureEvidenceToTransaction(
        input.db,
        input.processedEmailId,
        input.transactionId,
        input.updatedAt
      )
    )
  );
}

function ensureDefaultFinancialAccountEffect(input: DefaultAccountInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ ensureDefaultFinancialAccount }) =>
    fromThunk(() => ensureDefaultFinancialAccount(input.db, input.userId, { now: input.now }))
  );
}

function resolveEmailStatus(confidence: number): EmailSaveStatus {
  return confidence < 0.7 ? "needs_review" : "success";
}

function assertParsedTransaction(parsed: LlmParsedTransaction) {
  assertCopAmount(parsed.amount);
  assertIsoDate(parsed.date);
}

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
    operation: "insert",
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
  const row: ProcessedEmailRow = {
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

function saveTransactionEffect(input: SaveTransactionInput) {
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

function insertMerchantRuleEffect(input: MerchantRuleEffectInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ insertMerchantRule }) =>
    fromPromise(() =>
      insertMerchantRule(
        input.db,
        input.userId,
        input.merchantKey,
        input.categoryId,
        input.createdAt
      )
    )
  );
}

function markForRetryEffect(input: RetryScheduleEffectInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ markForRetry }) =>
    fromPromise(() => markForRetry(input.db, input.id, input.retryCount, input.nextRetryAt))
  );
}

function markPermanentlyFailedEffect(db: AnyDb, id: ProcessedEmailId) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ markPermanentlyFailed }) =>
    fromPromise(() => markPermanentlyFailed(db, id))
  );
}

function markRetrySuccessEffect(input: RetrySuccessEffectInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ markRetrySuccess }) =>
    fromPromise(() =>
      markRetrySuccess(input.db, input.id, input.status, input.transactionId, input.confidence)
    )
  );
}

function updateProcessedEmailStatusEffect(input: ProcessedEmailStatusEffectInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ updateProcessedEmailStatus }) =>
    fromPromise(() =>
      updateProcessedEmailStatus(input.db, input.id, input.status, input.transactionId)
    )
  );
}

function saveRetryTransactionEffect(input: SaveRetryTransactionInput) {
  return Effect.gen(function* () {
    const context = yield* createRetryTransactionContextEffect(input);
    yield* persistTransactionRecordEffect(context);
    yield* persistSuccessfulRetrySideEffectsEffect(context);
    return { txId: context.txId, status: context.status };
  });
}

function nextRetryAtEffect(retryCount: number) {
  return Effect.map(currentDateEffect, (now) => computeNextRetryAt(retryCount, now));
}

function createPipelineRuntime(deps: CreateEmailPipelineServiceDeps): PipelineRuntime {
  const { clock, telemetry, ...runtimeDeps } = deps;
  const clockRuntime = bindAppClock(clock);
  const telemetryRuntime = bindAppTelemetry(telemetry);
  const runtime = EmailPipelineDeps.bind(runtimeDeps);

  return {
    runClockEffect: (effect) => clockRuntime.run(effect),
    runTelemetryEffect: (effect) => telemetryRuntime.run(effect),
    runEmailEffect: (effect) => runtime.run(effect),
    runEmailWithClock: (effect) => runtime.run(clockRuntime.provide(effect)),
  };
}

function incrementPipelineMetric(result: PipelineResult, field: EmailMetric) {
  result[field] += 1;
}

function incrementRetryMetric(result: RetryResult, field: keyof RetryResult) {
  result[field] += 1;
}

function reportEmailProgress(context: EmailBatchContext) {
  context.onProgress?.(getProgressSnapshot(context.total, context.completed, context.result));
}

function completeEmailStep(context: EmailBatchContext) {
  context.completed += 1;
  reportEmailProgress(context);
}

function getNextQueuedEmail(queue: EmailQueue) {
  const email = queue.emails[queue.nextIdx];
  queue.nextIdx += 1;
  return email ?? null;
}

function dedupeRawEmails(rawEmails: RawEmail[]) {
  return Array.from(new Map(rawEmails.map((email) => [email.externalId, email])).values());
}

function createPipelineResult(skippedDuplicate: number): PipelineResult {
  return {
    filtered: 0,
    skippedDuplicate,
    skippedCrossSource: 0,
    saved: 0,
    failed: 0,
    needsReview: 0,
  };
}

function buildUnparsedProcessedEmailRow(input: UnparsedProcessedEmailRowInput): ProcessedEmailRow {
  const baseRow: ProcessedEmailRow = {
    id: input.processedEmailId,
    externalId: input.email.externalId,
    provider: input.email.provider,
    status: input.status,
    failureReason: input.status === "pending_retry" ? "parse_error" : null,
    subject: input.email.subject,
    rawBodyPreview: input.email.body.slice(0, 500),
    receivedAt: requireIsoDateTime(input.email.receivedAt),
    transactionId: null,
    confidence: null,
    createdAt: input.createdAt,
  };

  return input.status === "pending_retry"
    ? {
        ...baseRow,
        rawBody: input.email.body,
        retryCount: 0,
        nextRetryAt: input.nextRetryAt,
      }
    : baseRow;
}

function buildDuplicateProcessedEmailRow(
  input: DuplicateProcessedEmailRowInput
): ProcessedEmailRow {
  return {
    id: input.processedEmailId,
    externalId: input.email.externalId,
    provider: input.email.provider,
    status: "skipped_duplicate",
    failureReason: null,
    subject: input.email.subject,
    rawBodyPreview: input.email.body.slice(0, 500),
    receivedAt: requireIsoDateTime(input.email.receivedAt),
    transactionId: input.transactionId,
    confidence: input.confidence,
    createdAt: input.createdAt,
  };
}

async function createEmailBatchPlan(
  runtime: PipelineRuntime,
  db: AnyDb,
  rawEmails: RawEmail[]
): Promise<EmailBatchPlan> {
  const uniqueEmails = dedupeRawEmails(rawEmails);
  const dedupedInBatch = rawEmails.length - uniqueEmails.length;
  const processedIds = await runtime.runEmailEffect(
    getProcessedExternalIdsEffect(
      db,
      uniqueEmails.map((email) => email.externalId)
    )
  );
  const toProcess = uniqueEmails.filter((email) => !processedIds.has(email.externalId));
  const skippedAlreadyProcessed = uniqueEmails.length - toProcess.length;

  return {
    toProcess,
    dedupedInBatch,
    skippedAlreadyProcessed,
    result: createPipelineResult(dedupedInBatch + skippedAlreadyProcessed),
    total: toProcess.length,
  };
}

async function captureIncomingBatchEvent(
  runtime: PipelineRuntime,
  rawEmails: RawEmail[],
  batch: EmailBatchPlan
) {
  await runtime.runTelemetryEffect(
    capturePipelineEventEffect({
      source: "email",
      batchSize: rawEmails.length,
      uniqueProviders: new Set(rawEmails.map((email) => email.provider)).size,
      dedupedInBatch: batch.dedupedInBatch,
      skippedAlreadyProcessed: batch.skippedAlreadyProcessed,
      skippedCrossSource: batch.result.skippedCrossSource,
      saved: batch.result.saved,
      failed: batch.result.failed,
      needsReview: batch.result.needsReview,
    })
  );
}

async function parseIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail
): Promise<IncomingParseOutcome> {
  try {
    const parsed = await context.runtime.runEmailEffect(
      parseBodyEffect(context.db, context.userId, email.body)
    );
    return parsed ? { kind: "parsed", parsed } : { kind: "filtered" };
  } catch (error) {
    await context.runtime.runTelemetryEffect(
      captureWarningEffect("email_parse_exception", {
        provider: email.provider,
        errorType: error instanceof Error ? error.message : "unknown",
      })
    );
    return { kind: "failed" };
  }
}

async function createIncomingEmailPersistenceState(context: EmailBatchContext, email: RawEmail) {
  assertIsoDateTime(email.receivedAt);
  return {
    createdAt: await context.runtime.runClockEffect(currentIsoDateTimeEffect),
    processedEmailId: generateProcessedEmailId(),
  };
}

async function persistIncomingEmailRecord(input: IncomingEmailPersistenceInput) {
  await input.context.runtime.runEmailEffect(
    insertProcessedEmailEffect(input.context.db, input.row)
  );
  await input.context.runtime.runEmailEffect(
    saveEmailCaptureEvidenceEffect({
      db: input.context.db,
      userId: input.context.userId,
      from: input.email.from,
      processedEmailId: input.processedEmailId,
      transactionId: input.transactionId,
      now: input.createdAt,
    })
  );
}

async function persistUnparsedIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail,
  kind: UnparsedIncomingEmailKind
) {
  const { createdAt, processedEmailId } = await createIncomingEmailPersistenceState(context, email);
  const shouldRetry = kind === "failed";
  const nextRetryAt = shouldRetry
    ? await context.runtime.runClockEffect(nextRetryAtEffect(0))
    : null;
  const row = buildUnparsedProcessedEmailRow({
    email,
    processedEmailId,
    createdAt,
    status: shouldRetry ? "pending_retry" : "skipped",
    nextRetryAt,
  });

  await persistIncomingEmailRecord({
    context,
    email,
    row,
    processedEmailId,
    transactionId: null,
    createdAt,
  });
  incrementPipelineMetric(context.result, shouldRetry ? "failed" : "filtered");
}

async function lookupIncomingDuplicate(
  context: EmailBatchContext,
  parsed: LlmParsedTransaction
): Promise<DuplicateLookupOutcome> {
  try {
    const transactionId = await context.runtime.runEmailEffect(
      findDuplicateTransactionEffect(context.db, context.userId, parsed)
    );
    return transactionId ? { kind: "duplicate", transactionId } : { kind: "new" };
  } catch (error) {
    await context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return { kind: "failed" };
  }
}

async function persistDuplicateIncomingEmail(input: {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly parsed: LlmParsedTransaction;
  readonly transactionId: TransactionId;
}) {
  const { createdAt, processedEmailId } = await createIncomingEmailPersistenceState(
    input.context,
    input.email
  );
  const row = buildDuplicateProcessedEmailRow({
    email: input.email,
    processedEmailId,
    transactionId: input.transactionId,
    confidence: input.parsed.confidence,
    createdAt,
  });

  await persistIncomingEmailRecord({
    context: input.context,
    email: input.email,
    row,
    processedEmailId,
    transactionId: input.transactionId,
    createdAt,
  });
  incrementPipelineMetric(input.context.result, "skippedCrossSource");
}

async function cacheMerchantRule(input: {
  readonly context: EmailBatchContext;
  readonly parsed: LlmParsedTransaction;
}) {
  try {
    const createdAt = await input.context.runtime.runClockEffect(currentIsoDateTimeEffect);
    await input.context.runtime.runEmailEffect(
      insertMerchantRuleEffect({
        db: input.context.db,
        userId: input.context.userId,
        merchantKey: normalizeMerchant(input.parsed.description),
        categoryId: getPersistedCategoryId(input.parsed.categoryId),
        createdAt,
      })
    );
  } catch (error) {
    await input.context.runtime.runTelemetryEffect(captureErrorEffect(error));
  }
}

async function persistIncomingTransaction(input: {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly parsed: LlmParsedTransaction;
  readonly status: EmailSaveStatus;
}) {
  try {
    await input.context.runtime.runEmailWithClock(
      saveTransactionEffect({
        db: input.context.db,
        userId: input.context.userId,
        parsed: input.parsed,
        email: input.email,
        status: input.status,
      })
    );
    if (input.status === "success") {
      await cacheMerchantRule({ context: input.context, parsed: input.parsed });
    }
    return true;
  } catch (error) {
    await input.context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return false;
  }
}

async function processParsedIncomingEmail(
  context: EmailBatchContext,
  email: RawEmail,
  parsed: LlmParsedTransaction
) {
  const duplicate = await lookupIncomingDuplicate(context, parsed);
  if (duplicate.kind === "failed") {
    incrementPipelineMetric(context.result, "failed");
    return;
  }

  if (duplicate.kind === "duplicate") {
    await persistDuplicateIncomingEmail({
      context,
      email,
      parsed,
      transactionId: duplicate.transactionId,
    });
    return;
  }

  const status = resolveEmailStatus(parsed.confidence);
  const saved = await persistIncomingTransaction({ context, email, parsed, status });
  if (!saved) {
    incrementPipelineMetric(context.result, "failed");
    return;
  }

  incrementPipelineMetric(context.result, status === "success" ? "saved" : "needsReview");
}

async function processIncomingEmail(context: EmailBatchContext, email: RawEmail) {
  const parsed = await parseIncomingEmail(context, email);
  if (parsed.kind !== "parsed") {
    await persistUnparsedIncomingEmail(context, email, parsed.kind);
    completeEmailStep(context);
    return;
  }

  await processParsedIncomingEmail(context, email, parsed.parsed);
  completeEmailStep(context);
}

const EMAIL_WORKER_CONCURRENCY = 5;

async function runEmailWorker(context: EmailBatchContext, queue: EmailQueue): Promise<void> {
  // FP exemption: a shared queue keeps concurrency bounded while preserving real-time progress updates.
  while (true) {
    const email = getNextQueuedEmail(queue);
    if (!email) return;
    await processIncomingEmail(context, email);
  }
}

async function runEmailWorkers(context: EmailBatchContext, emails: RawEmail[]) {
  const queue: EmailQueue = { emails, nextIdx: 0 };
  const workerCount = Math.min(EMAIL_WORKER_CONCURRENCY, emails.length);
  await Promise.all(Array.from({ length: workerCount }, () => runEmailWorker(context, queue)));
}

async function processEmailBatch(runtime: PipelineRuntime, input: ProcessEmailsInput) {
  const batch = await createEmailBatchPlan(runtime, input.db, input.rawEmails);
  const context: EmailBatchContext = {
    runtime,
    db: input.db,
    userId: input.userId,
    result: batch.result,
    total: batch.total,
    onProgress: input.onProgress,
    completed: 0,
  };

  reportEmailProgress(context);
  await runEmailWorkers(context, batch.toProcess);
  await captureIncomingBatchEvent(runtime, input.rawEmails, batch);
  return batch.result;
}

async function parseRetryEmail(
  context: RetryBatchContext,
  email: ProcessedEmailRow
): Promise<RetryParseOutcome> {
  const rawBody = email.rawBody;
  if (!rawBody) return { kind: "retry" };

  try {
    const parsed = await context.runtime.runEmailEffect(
      parseBodyEffect(context.db, context.userId, rawBody)
    );
    return parsed ? { kind: "parsed", parsed } : { kind: "skipped" };
  } catch (error) {
    await context.runtime.runTelemetryEffect(
      captureWarningEffect("email_retry_parse_exception", {
        provider: email.provider,
        errorType: error instanceof Error ? error.message : "unknown",
      })
    );
    return { kind: "retry" };
  }
}

async function markRetryAsPermanentlyFailed(context: RetryBatchContext, id: ProcessedEmailId) {
  await context.runtime.runEmailEffect(markPermanentlyFailedEffect(context.db, id));
  incrementRetryMetric(context.result, "permanentlyFailed");
}

async function scheduleRetryOrFail(context: RetryBatchContext, email: ProcessedEmailRow) {
  const retryCount = (email.retryCount ?? 0) + 1;
  const nextRetryAt = await context.runtime.runClockEffect(nextRetryAtEffect(retryCount));

  if (isMaxRetriesReached(retryCount)) {
    await markRetryAsPermanentlyFailed(context, email.id);
    return;
  }

  await context.runtime.runEmailEffect(
    markForRetryEffect({
      db: context.db,
      id: email.id,
      retryCount,
      nextRetryAt,
    })
  );
  incrementRetryMetric(context.result, "retried");
}

async function handleRetryParseOutcome(
  context: RetryBatchContext,
  email: ProcessedEmailRow,
  kind: Exclude<RetryParseOutcome["kind"], "parsed">
) {
  if (kind === "retry") {
    await scheduleRetryOrFail(context, email);
    return;
  }

  await context.runtime.runEmailEffect(
    updateProcessedEmailStatusEffect({
      db: context.db,
      id: email.id,
      status: "skipped",
      transactionId: null,
    })
  );
}

async function lookupRetryDuplicate(
  context: RetryBatchContext,
  parsed: LlmParsedTransaction
): Promise<RetryDuplicateOutcome> {
  try {
    const transactionId = await context.runtime.runEmailEffect(
      findDuplicateTransactionEffect(context.db, context.userId, parsed)
    );
    return transactionId ? { kind: "duplicate", transactionId } : { kind: "new" };
  } catch (error) {
    await context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return { kind: "retry" };
  }
}

async function finalizeRetrySuccess(input: {
  readonly context: RetryBatchContext;
  readonly emailId: ProcessedEmailId;
  readonly transactionId: TransactionId;
  readonly status: EmailSaveStatus;
  readonly confidence: number;
}) {
  const updatedAt = await input.context.runtime.runClockEffect(currentIsoDateTimeEffect);

  await input.context.runtime.runEmailEffect(
    linkCaptureEvidenceToTransactionEffect({
      db: input.context.db,
      processedEmailId: input.emailId,
      transactionId: input.transactionId,
      updatedAt,
    })
  );
  await input.context.runtime.runEmailEffect(
    markRetrySuccessEffect({
      db: input.context.db,
      id: input.emailId,
      status: input.status,
      transactionId: input.transactionId,
      confidence: input.confidence,
    })
  );
  incrementRetryMetric(input.context.result, "succeeded");
}

async function persistRetryTransaction(input: {
  readonly context: RetryBatchContext;
  readonly email: ProcessedEmailRow;
  readonly parsed: LlmParsedTransaction;
}) {
  try {
    const { txId, status } = await input.context.runtime.runEmailWithClock(
      saveRetryTransactionEffect({
        db: input.context.db,
        userId: input.context.userId,
        parsed: input.parsed,
        email: input.email,
      })
    );
    await finalizeRetrySuccess({
      context: input.context,
      emailId: input.email.id,
      transactionId: txId,
      status,
      confidence: input.parsed.confidence,
    });
    return true;
  } catch (error) {
    await input.context.runtime.runTelemetryEffect(captureErrorEffect(error));
    return false;
  }
}

async function processParsedRetryEmail(
  context: RetryBatchContext,
  email: ProcessedEmailRow,
  parsed: LlmParsedTransaction
) {
  const duplicate = await lookupRetryDuplicate(context, parsed);
  if (duplicate.kind === "retry") {
    await scheduleRetryOrFail(context, email);
    return;
  }

  if (duplicate.kind === "duplicate") {
    await finalizeRetrySuccess({
      context,
      emailId: email.id,
      transactionId: duplicate.transactionId,
      status: "success",
      confidence: parsed.confidence,
    });
    return;
  }

  const saved = await persistRetryTransaction({ context, email, parsed });
  if (!saved) {
    await scheduleRetryOrFail(context, email);
  }
}

async function processRetryEmail(context: RetryBatchContext, email: ProcessedEmailRow) {
  if (!email.rawBody) {
    await markRetryAsPermanentlyFailed(context, email.id);
    return;
  }

  const parsed = await parseRetryEmail(context, email);
  if (parsed.kind !== "parsed") {
    await handleRetryParseOutcome(context, email, parsed.kind);
    return;
  }

  await processParsedRetryEmail(context, email, parsed.parsed);
}

async function processRetryBatch(runtime: PipelineRuntime, input: ProcessRetriesInput) {
  const result: RetryResult = { retried: 0, succeeded: 0, permanentlyFailed: 0 };
  const context: RetryBatchContext = {
    runtime,
    db: input.db,
    userId: input.userId,
    result,
  };
  const pendingEmails = await runtime.runEmailEffect(getPendingRetryEmailsEffect(input.db));

  for (const email of pendingEmails) {
    await processRetryEmail(context, email);
  }

  return result;
}

export function createEmailPipelineService(
  deps: CreateEmailPipelineServiceDeps
): EmailPipelineService {
  const runtime = createPipelineRuntime(deps);

  return {
    async processEmails(...args: Parameters<EmailPipelineService["processEmails"]>) {
      const [db, userId, rawEmails, onProgress] = args;
      return processEmailBatch(runtime, { db, userId, rawEmails, onProgress });
    },

    async processRetries(db, userId) {
      return processRetryBatch(runtime, { db, userId });
    },
  };
}

export type ProcessEmails = EmailPipelineService["processEmails"];
export type ProcessRetries = EmailPipelineService["processRetries"];
