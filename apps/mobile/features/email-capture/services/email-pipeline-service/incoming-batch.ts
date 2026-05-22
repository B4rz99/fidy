import type { AnyDb } from "@/shared/db";
import { capturePipelineEventEffect } from "@/shared/effect/telemetry";
import { isEmailCaptureDebugEnabled } from "../email-capture-debug";
import { buildEmailPipelineBatchTelemetry } from "./email-telemetry";
import { processIncomingEmail } from "./incoming-email";
import { getProcessedEmailSourceEventIdsEffect } from "./runtime";
import {
  createPipelineResult,
  dedupeRawEmails,
  getEmailSourceId,
  getEmailSourceEventKey,
  getNextQueuedEmail,
  getProgressSnapshot,
  mergePipelineResults,
} from "./shared";
import type {
  EmailBatchContext,
  EmailBatchPlan,
  EmailQueue,
  IncomingEmailOutcome,
  PipelineRuntime,
  PipelineResult,
  ProcessEmailsInput,
  RawEmail,
} from "./types";

type EmailBatchTiming = {
  readonly batchDurationMs: number;
  readonly parseTotalDurationMs: number;
  readonly parseMaxDurationMs: number;
  readonly parseAverageDurationMs: number;
  readonly persistenceTotalDurationMs: number;
  readonly firstSavedLatencyMs: number | null;
};

type EmailBatchTimingAccumulator = {
  readonly count: number;
  readonly parseTotalDurationMs: number;
  readonly parseMaxDurationMs: number;
  readonly persistenceTotalDurationMs: number;
};

type RegexParseAccumulator = {
  readonly parsed: number;
  readonly missed: number;
  readonly unsupported: number;
};

const nowMs = (): number => Date.now();

const logRegexSummaryForDebug = (input: {
  readonly emailCount: number;
  readonly regex: RegexParseAccumulator;
  readonly result: PipelineResult;
}): void => {
  if (!isEmailCaptureDebugEnabled()) return;

  // eslint-disable-next-line no-console
  console.log("[email-capture] regex.summary", {
    emailCount: input.emailCount,
    regexCandidates: input.regex.parsed + input.regex.missed,
    regexParsed: input.regex.parsed,
    regexMissed: input.regex.missed,
    regexUnsupported: input.regex.unsupported,
    saved: input.result.saved,
    needsReview: input.result.needsReview,
    filtered: input.result.filtered,
    failed: input.result.failed,
  });
};

async function createEmailBatchPlan(
  runtime: PipelineRuntime,
  db: AnyDb,
  userId: ProcessEmailsInput["userId"],
  rawEmails: RawEmail[]
): Promise<EmailBatchPlan> {
  const uniqueEmails = dedupeRawEmails(rawEmails);
  const dedupedInBatch = rawEmails.length - uniqueEmails.length;
  const sourceEvents = uniqueEmails.map((email) => ({
    sourceId: getEmailSourceId(email),
    sourceEventId: email.externalId,
  }));
  const sourceEventIds = await runtime.runEmailEffect(
    getProcessedEmailSourceEventIdsEffect(db, userId, sourceEvents)
  );
  const toProcess = uniqueEmails.filter(
    (email) => !sourceEventIds.has(getEmailSourceEventKey(email))
  );
  const boundedToProcess =
    runtime.maxCandidateEmails == null ? toProcess : toProcess.slice(0, runtime.maxCandidateEmails);
  const skippedAlreadyProcessed = uniqueEmails.length - toProcess.length;

  return {
    toProcess: boundedToProcess,
    dedupedInBatch,
    skippedAlreadyProcessed,
    result: createPipelineResult(dedupedInBatch + skippedAlreadyProcessed),
    total: boundedToProcess.length,
  };
}

const buildIncomingBatchTelemetry = (input: {
  readonly rawEmails: RawEmail[];
  readonly batch: EmailBatchPlan;
  readonly result: PipelineResult;
  readonly timing: EmailBatchTiming;
}) =>
  buildEmailPipelineBatchTelemetry({
    rawEmails: input.rawEmails,
    dedupedInBatch: input.batch.dedupedInBatch,
    skippedAlreadyProcessed: input.batch.skippedAlreadyProcessed,
    timing: input.timing,
    result: input.result,
  });

async function waitForParseRateLimit(context: EmailBatchContext): Promise<void> {
  const delayMs = context.runtime.parseRateLimit.delayMs;
  if (context.parseStarts === 0) {
    context.parseStarts = 1;
    return;
  }

  const scheduledStart = context.parseStartGate.then(async () => {
    if (delayMs > 0) {
      await context.runtime.parseRateLimit.sleep(delayMs);
    }
    context.parseStarts += 1;
  });

  context.parseStartGate = scheduledStart.catch(() => undefined);
  await scheduledStart;
}

async function runEmailWorker(input: {
  readonly context: EmailBatchContext;
  readonly queue: EmailQueue;
  readonly onOutcome: (outcome: IncomingEmailOutcome) => void;
}): Promise<void> {
  // FP exemption: workers share a queue so parse calls can run without artificial batching.
  while (true) {
    if (input.context.signal?.aborted) return;
    const email = getNextQueuedEmail(input.queue);
    if (!email) return;
    await waitForParseRateLimit(input.context);
    if (input.context.signal?.aborted) return;
    input.onOutcome(await processIncomingEmail(input.context, email));
  }
}

async function runEmailWorkers(input: {
  readonly context: EmailBatchContext;
  readonly emails: RawEmail[];
  readonly onOutcome: (outcome: IncomingEmailOutcome) => void;
}) {
  const queue: EmailQueue = { emails: input.emails, nextIdx: 0 };
  const concurrency = input.context.runtime.parseRateLimit.concurrency;
  const workerCount =
    concurrency == null
      ? input.emails.length
      : Math.min(Math.max(1, concurrency), input.emails.length);
  const results = await Promise.allSettled(
    Array.from({ length: workerCount }, () =>
      runEmailWorker({ context: input.context, queue, onOutcome: input.onOutcome })
    )
  );
  const rejection = results.find((result) => result.status === "rejected");
  if (rejection?.status === "rejected") {
    throw rejection.reason;
  }
}

const createTimingAccumulator = (): EmailBatchTimingAccumulator => ({
  count: 0,
  parseTotalDurationMs: 0,
  parseMaxDurationMs: 0,
  persistenceTotalDurationMs: 0,
});

const createRegexAccumulator = (): RegexParseAccumulator => ({
  parsed: 0,
  missed: 0,
  unsupported: 0,
});

const addOutcomeTiming = (
  timing: EmailBatchTimingAccumulator,
  outcome: IncomingEmailOutcome
): EmailBatchTimingAccumulator => ({
  count: timing.count + 1,
  parseTotalDurationMs: timing.parseTotalDurationMs + outcome.parseDurationMs,
  parseMaxDurationMs: Math.max(timing.parseMaxDurationMs, outcome.parseDurationMs),
  persistenceTotalDurationMs: timing.persistenceTotalDurationMs + outcome.persistenceDurationMs,
});

const summarizeBatchTiming = (
  timing: EmailBatchTimingAccumulator,
  batchDurationMs: number,
  firstSavedLatencyMs: number | null
): EmailBatchTiming => ({
  batchDurationMs,
  parseTotalDurationMs: timing.parseTotalDurationMs,
  parseMaxDurationMs: timing.parseMaxDurationMs,
  parseAverageDurationMs:
    timing.count === 0 ? 0 : Math.round(timing.parseTotalDurationMs / timing.count),
  persistenceTotalDurationMs: timing.persistenceTotalDurationMs,
  firstSavedLatencyMs,
});

const addRegexOutcome = (
  regex: RegexParseAccumulator,
  outcome: IncomingEmailOutcome
): RegexParseAccumulator => ({
  ...regex,
  [outcome.regexParseStatus]: regex[outcome.regexParseStatus] + 1,
});

export async function processEmailBatch(runtime: PipelineRuntime, input: ProcessEmailsInput) {
  const batchStartedAt = nowMs();
  const batch = await createEmailBatchPlan(runtime, input.db, input.userId, input.rawEmails);
  const context: EmailBatchContext = {
    runtime,
    db: input.db,
    userId: input.userId,
    signal: input.signal,
    parseStarts: 0,
    parseStartGate: Promise.resolve(),
    persistenceGate: Promise.resolve(),
  };
  let completed = 0;
  let firstSavedLatencyMs: number | null = null;
  let timing = createTimingAccumulator();
  let regex = createRegexAccumulator();
  let progressResult = batch.result;
  const reportProgress = () => {
    input.onProgress?.(getProgressSnapshot(batch.total, completed, progressResult));
  };

  reportProgress();
  await runEmailWorkers({
    context,
    emails: batch.toProcess,
    onOutcome: (outcome) => {
      completed += 1;
      timing = addOutcomeTiming(timing, outcome);
      regex = addRegexOutcome(regex, outcome);
      if (firstSavedLatencyMs === null && outcome.savedTransaction) {
        firstSavedLatencyMs = nowMs() - batchStartedAt;
      }
      progressResult = mergePipelineResults([progressResult, outcome.result]);
      reportProgress();
    },
  });
  const telemetry = buildIncomingBatchTelemetry({
    rawEmails: input.rawEmails,
    batch,
    result: progressResult,
    timing: summarizeBatchTiming(timing, nowMs() - batchStartedAt, firstSavedLatencyMs),
  });
  await runtime.runTelemetryEffect(capturePipelineEventEffect(telemetry));
  logRegexSummaryForDebug({
    emailCount: batch.total,
    regex,
    result: progressResult,
  });
  return progressResult;
}
