import { Effect } from "effect";
import {
  type CaptureEvidenceRow,
  materializeCaptureEvidenceRows,
} from "@/features/capture-evidence/write.public";
import type { AnyDb } from "@/shared/db";
import { bindAppClock, currentDateEffect } from "@/shared/effect/clock";
import { fromPromise, fromThunk, makeAppService } from "@/shared/effect/runtime";
import { bindAppTelemetry } from "@/shared/effect/telemetry";
import { normalizeMerchant } from "@/shared/lib";
import { computeNextRetryAt } from "../../lib/retry-backoff";
import { getParsedCounterpartyName } from "./shared";
import type {
  CaptureEvidenceRowsInput,
  CaptureEvidenceSaveInput,
  CreateEmailPipelineServiceDeps,
  DefaultAccountInput,
  LlmParsedTransaction,
  MerchantRuleEffectInput,
  PipelineRuntime,
  ProcessedSourceEventId,
  ProcessedSourceEventRow,
  ProcessedSourceEventStatusEffectInput,
  SourceEventRetryScheduleEffectInput,
  SourceEventRetrySuccessEffectInput,
  UserId,
} from "./types";

export const EmailPipelineDeps = makeAppService<CreateEmailPipelineServiceDeps>(
  "@/features/email-capture/EmailPipelineDeps"
);

const DEFAULT_PARSE_RATE_LIMIT_DELAY_MS = 0;
const DEFAULT_PARSE_RATE_LIMIT_CONCURRENCY: number | null = null;

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export class EmailParseApiError extends Error {
  constructor(readonly originalError: unknown) {
    super("Email parse API failed");
    this.name = "EmailParseApiError";
  }
}

export function parseBodyEffect(db: AnyDb, userId: UserId, body: string) {
  return Effect.gen(function* () {
    const { parseEmailApi, parseContext, lookupMerchantRule } = yield* EmailPipelineDeps.tag;
    const llmResult = yield* Effect.mapError(
      fromPromise(() =>
        parseContext ? parseEmailApi(body, { parseContext }) : parseEmailApi(body)
      ),
      (error) => new EmailParseApiError(error)
    );
    if (!llmResult) return null;

    const merchantKey = normalizeMerchant(getParsedCounterpartyName(llmResult));
    const cachedCategoryId = yield* fromPromise(() => lookupMerchantRule(db, userId, merchantKey));

    return cachedCategoryId
      ? { ...llmResult, categoryId: cachedCategoryId, confidence: 1.0 }
      : llmResult;
  });
}

export function getProcessedEmailSourceEventIdsEffect(
  db: AnyDb,
  userId: UserId,
  sourceEvents: readonly { readonly sourceId: string; readonly sourceEventId: string }[]
) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ getProcessedEmailSourceEventIds }) =>
    fromPromise(() => getProcessedEmailSourceEventIds(db, userId, sourceEvents))
  );
}

export function getPendingRetryEmailSourceEventsEffect(db: AnyDb, userId: UserId) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ getPendingRetryEmailSourceEvents }) =>
    fromPromise(() => getPendingRetryEmailSourceEvents(db, userId))
  );
}

export function resolveRetryEmailBodyEffect(
  db: AnyDb,
  userId: UserId,
  sourceEvent: ProcessedSourceEventRow
) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ resolveRetryEmailBody }) =>
    fromPromise(() => resolveRetryEmailBody?.(db, userId, sourceEvent) ?? Promise.resolve(null))
  );
}

export function findDuplicateTransactionEffect(
  db: AnyDb,
  userId: UserId,
  parsed: LlmParsedTransaction
) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ findDuplicateTransaction }) =>
    fromPromise(() =>
      findDuplicateTransaction({
        db,
        userId,
        amount: parsed.amount,
        date: parsed.date,
        merchant: getParsedCounterpartyName(parsed),
      })
    )
  );
}

export function insertProcessedEmailSourceEventEffect(db: AnyDb, row: ProcessedSourceEventRow) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ insertProcessedEmailSourceEvent }) =>
    fromThunk(() => insertProcessedEmailSourceEvent(db, row))
  );
}

function buildEmailCaptureEvidenceRows(input: CaptureEvidenceRowsInput) {
  return materializeCaptureEvidenceRows(
    input.buildEmailCaptureEvidence({
      from: input.from,
      body: input.body,
      fromAccountHint: input.fromAccountHint,
      toAccountHint: input.toAccountHint,
      cardProductHint: input.cardProductHint,
      accountTypeHint: input.accountTypeHint,
      counterpartyHint: input.counterpartyHint,
    }),
    {
      userId: input.userId,
      transactionId: input.transactionId,
      processedSourceEventId: input.processedSourceEventId,
      createdAt: input.now,
      updatedAt: input.now,
    }
  );
}

function saveCaptureEvidenceRowsEffect(db: AnyDb, rows: readonly CaptureEvidenceRow[]) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ saveCaptureEvidenceRows }) =>
    fromThunk(() => saveCaptureEvidenceRows(db, rows))
  );
}

export function saveEmailCaptureEvidenceEffect(input: CaptureEvidenceSaveInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ buildEmailCaptureEvidence }) =>
    saveCaptureEvidenceRowsEffect(
      input.db,
      buildEmailCaptureEvidenceRows({
        userId: input.userId,
        from: input.from,
        body: input.body,
        fromAccountHint: input.fromAccountHint,
        toAccountHint: input.toAccountHint,
        cardProductHint: input.cardProductHint,
        accountTypeHint: input.accountTypeHint,
        counterpartyHint: input.counterpartyHint,
        processedSourceEventId: input.processedSourceEventId,
        transactionId: input.transactionId,
        now: input.now,
        buildEmailCaptureEvidence,
      })
    )
  );
}

export function ensureDefaultFinancialAccountEffect(input: DefaultAccountInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ ensureDefaultFinancialAccount }) =>
    fromThunk(() => ensureDefaultFinancialAccount(input.db, input.userId, { now: input.now }))
  );
}

export function insertMerchantRuleEffect(input: MerchantRuleEffectInput) {
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

export function markSourceEventForRetryEffect(input: SourceEventRetryScheduleEffectInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ markSourceEventForRetry }) =>
    fromPromise(() =>
      markSourceEventForRetry({
        db: input.db,
        id: input.id,
        retryCount: input.retryCount,
        nextRetryAt: input.nextRetryAt,
      })
    )
  );
}

export function markSourceEventPermanentlyFailedEffect(db: AnyDb, id: ProcessedSourceEventId) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ markSourceEventPermanentlyFailed }) =>
    fromPromise(() => markSourceEventPermanentlyFailed(db, id))
  );
}

export function markSourceEventRetrySuccessEffect(input: SourceEventRetrySuccessEffectInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ markSourceEventRetrySuccess }) =>
    fromPromise(() =>
      markSourceEventRetrySuccess({
        db: input.db,
        id: input.id,
        status: input.status,
        transactionId: input.transactionId,
        confidence: input.confidence,
      })
    )
  );
}

export function updateProcessedSourceEventStatusEffect(
  input: ProcessedSourceEventStatusEffectInput
) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ updateProcessedSourceEventStatus }) =>
    fromPromise(() =>
      updateProcessedSourceEventStatus({
        db: input.db,
        id: input.id,
        status: input.status,
        transactionId: input.transactionId,
        rawBody: input.rawBody,
      })
    )
  );
}

export function nextRetryAtEffect(retryCount: number) {
  return Effect.map(currentDateEffect, (now) => computeNextRetryAt(retryCount, now));
}

export function createPipelineRuntime(deps: CreateEmailPipelineServiceDeps): PipelineRuntime {
  const { clock, telemetry, parseRateLimit, maxCandidateEmails, ...runtimeDeps } = deps;
  const clockRuntime = bindAppClock(clock);
  const telemetryRuntime = bindAppTelemetry(telemetry);
  const runtime = EmailPipelineDeps.bind(runtimeDeps);

  return {
    runClockEffect: (effect) => clockRuntime.run(effect),
    runTelemetryEffect: (effect) => telemetryRuntime.run(effect),
    runEmailEffect: (effect) => runtime.run(effect),
    runEmailWithClock: (effect) => runtime.run(clockRuntime.provide(effect)),
    parseRateLimit: {
      delayMs: parseRateLimit?.delayMs ?? DEFAULT_PARSE_RATE_LIMIT_DELAY_MS,
      concurrency: parseRateLimit?.concurrency ?? DEFAULT_PARSE_RATE_LIMIT_CONCURRENCY,
      sleep: parseRateLimit?.sleep ?? sleep,
    },
    maxCandidateEmails,
  };
}
