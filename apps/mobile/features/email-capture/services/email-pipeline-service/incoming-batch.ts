import type { AnyDb } from "@/shared/db";
import { capturePipelineEventEffect } from "@/shared/effect/telemetry";
import { buildEmailPipelineBatchTelemetry } from "./email-telemetry";
import { processIncomingEmail } from "./incoming-email";
import { getProcessedExternalIdsEffect } from "./runtime";
import {
  completeEmailStep,
  createPipelineResult,
  dedupeRawEmails,
  getNextQueuedEmail,
  reportEmailProgress,
} from "./shared";
import type {
  EmailBatchContext,
  EmailBatchPlan,
  EmailQueue,
  PipelineRuntime,
  ProcessEmailsInput,
  RawEmail,
} from "./types";

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

async function captureIncomingBatchEvent(
  runtime: PipelineRuntime,
  rawEmails: RawEmail[],
  batch: EmailBatchPlan
) {
  await runtime.runTelemetryEffect(
    capturePipelineEventEffect(
      buildEmailPipelineBatchTelemetry({
        rawEmails,
        dedupedInBatch: batch.dedupedInBatch,
        skippedAlreadyProcessed: batch.skippedAlreadyProcessed,
        result: batch.result,
      })
    )
  );
}

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

async function runEmailWorker(context: EmailBatchContext, queue: EmailQueue): Promise<void> {
  // FP exemption: the worker queue keeps parse-email calls serialized for Edge Function rate limits.
  while (true) {
    const email = getNextQueuedEmail(queue);
    if (!email) return;
    await waitForParseRateLimit(context);
    await processIncomingEmail(context, email);
    completeEmailStep(context);
  }
}

async function runEmailWorkers(context: EmailBatchContext, emails: RawEmail[]) {
  const queue: EmailQueue = { emails, nextIdx: 0 };
  const workerCount = Math.min(
    Math.max(1, context.runtime.parseRateLimit.concurrency),
    emails.length
  );
  await Promise.all(Array.from({ length: workerCount }, () => runEmailWorker(context, queue)));
}

export async function processEmailBatch(runtime: PipelineRuntime, input: ProcessEmailsInput) {
  const batch = await createEmailBatchPlan(runtime, input.db, input.rawEmails);
  const context: EmailBatchContext = {
    runtime,
    db: input.db,
    userId: input.userId,
    result: batch.result,
    total: batch.total,
    onProgress: input.onProgress,
    completed: 0,
    parseStarts: 0,
    parseStartGate: Promise.resolve(),
    persistenceGate: Promise.resolve(),
  };

  reportEmailProgress(context);
  await runEmailWorkers(context, batch.toProcess);
  await captureIncomingBatchEvent(runtime, input.rawEmails, batch);
  return batch.result;
}
