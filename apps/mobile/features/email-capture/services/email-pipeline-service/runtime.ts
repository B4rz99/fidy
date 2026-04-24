import { Effect } from "effect";
import {
  type CaptureEvidenceRow,
  materializeCaptureEvidenceRows,
} from "@/features/capture-evidence/public";
import type { AnyDb } from "@/shared/db";
import { type AppClock, bindAppClock, currentDateEffect } from "@/shared/effect/clock";
import { fromPromise, fromThunk, makeAppService } from "@/shared/effect/runtime";
import { type AppTelemetry, bindAppTelemetry } from "@/shared/effect/telemetry";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { computeNextRetryAt } from "../../lib/retry-backoff";
import type {
  CaptureEvidenceRowsInput,
  CaptureEvidenceSaveInput,
  CreateEmailPipelineServiceDeps,
  DefaultAccountInput,
  LinkCaptureEvidenceInput,
  LlmParsedTransaction,
  MerchantRuleEffectInput,
  PipelineRuntime,
  ProcessedEmailId,
  ProcessedEmailRow,
  ProcessedEmailStatusEffectInput,
  RetryScheduleEffectInput,
  RetrySuccessEffectInput,
  UserId,
} from "./types";

export const EmailPipelineDeps = makeAppService<CreateEmailPipelineServiceDeps>(
  "@/features/email-capture/EmailPipelineDeps"
);

export function parseBodyEffect(db: AnyDb, userId: UserId, body: string) {
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

export function getProcessedExternalIdsEffect(db: AnyDb, externalIds: string[]) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ getProcessedExternalIds }) =>
    fromPromise(() => getProcessedExternalIds(db, externalIds))
  );
}

export function getPendingRetryEmailsEffect(db: AnyDb) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ getPendingRetryEmails }) =>
    fromPromise(() => getPendingRetryEmails(db))
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
        merchant: parsed.description,
      })
    )
  );
}

export function insertProcessedEmailEffect(db: AnyDb, row: ProcessedEmailRow) {
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

export function saveEmailCaptureEvidenceEffect(input: CaptureEvidenceSaveInput) {
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

export function linkCaptureEvidenceToTransactionEffect(input: LinkCaptureEvidenceInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ linkCaptureEvidenceToTransaction }) =>
    fromThunk(() =>
      linkCaptureEvidenceToTransaction(input.db, {
        processedEmailId: input.processedEmailId,
        transactionId: input.transactionId,
        updatedAt: input.updatedAt,
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

export function markForRetryEffect(input: RetryScheduleEffectInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ markForRetry }) =>
    fromPromise(() =>
      markForRetry({
        db: input.db,
        id: input.id,
        retryCount: input.retryCount,
        nextRetryAt: input.nextRetryAt,
      })
    )
  );
}

export function markPermanentlyFailedEffect(db: AnyDb, id: ProcessedEmailId) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ markPermanentlyFailed }) =>
    fromPromise(() => markPermanentlyFailed(db, id))
  );
}

export function markRetrySuccessEffect(input: RetrySuccessEffectInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ markRetrySuccess }) =>
    fromPromise(() =>
      markRetrySuccess({
        db: input.db,
        id: input.id,
        status: input.status,
        transactionId: input.transactionId,
        confidence: input.confidence,
      })
    )
  );
}

export function updateProcessedEmailStatusEffect(input: ProcessedEmailStatusEffectInput) {
  return Effect.flatMap(EmailPipelineDeps.tag, ({ updateProcessedEmailStatus }) =>
    fromPromise(() =>
      updateProcessedEmailStatus({
        db: input.db,
        id: input.id,
        status: input.status,
        transactionId: input.transactionId,
      })
    )
  );
}

export function nextRetryAtEffect(retryCount: number) {
  return Effect.map(currentDateEffect, (now) => computeNextRetryAt(retryCount, now));
}

export function createPipelineRuntime(deps: CreateEmailPipelineServiceDeps): PipelineRuntime {
  const { clock, telemetry, ...runtimeDeps } = deps;
  const clockRuntime = bindAppClock(clock as AppClock | undefined);
  const telemetryRuntime = bindAppTelemetry(telemetry as AppTelemetry | undefined);
  const runtime = EmailPipelineDeps.bind(runtimeDeps);

  return {
    runClockEffect: (effect) => clockRuntime.run(effect),
    runTelemetryEffect: (effect) => telemetryRuntime.run(effect),
    runEmailEffect: (effect) => runtime.run(effect),
    runEmailWithClock: (effect) => runtime.run(clockRuntime.provide(effect)),
  };
}
