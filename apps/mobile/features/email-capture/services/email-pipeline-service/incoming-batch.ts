import type { AnyDb } from "@/shared/db";
import { capturePipelineEventEffect } from "@/shared/effect/telemetry";
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

const EMAIL_WORKER_CONCURRENCY = 5;

async function runEmailWorker(context: EmailBatchContext, queue: EmailQueue): Promise<void> {
  // FP exemption: a shared queue keeps concurrency bounded while preserving real-time progress updates.
  while (true) {
    const email = getNextQueuedEmail(queue);
    if (!email) return;
    await processIncomingEmail(context, email);
    completeEmailStep(context);
  }
}

async function runEmailWorkers(context: EmailBatchContext, emails: RawEmail[]) {
  const queue: EmailQueue = { emails, nextIdx: 0 };
  const workerCount = Math.min(EMAIL_WORKER_CONCURRENCY, emails.length);
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
  };

  reportEmailProgress(context);
  await runEmailWorkers(context, batch.toProcess);
  await captureIncomingBatchEvent(runtime, input.rawEmails, batch);
  return batch.result;
}
