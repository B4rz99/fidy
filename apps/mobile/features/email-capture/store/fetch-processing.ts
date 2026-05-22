import type { AnyDb } from "@/shared/db";
import { captureWarning, toIsoDateTime } from "@/shared/lib";
import type { EmailAccountId, UserId } from "@/shared/types/branded";
import {
  type EmailAccountFetchResult,
  type EmailCaptureParseProfile,
  ingestFetchedEmails,
  type ProcessedEmailAccountFetchResult,
  persistFetchedAccounts,
  resolveEmailCaptureSyncPolicy,
  sortFetchResultsByNewestEmail,
} from "../services/email-capture-fetch-service";
import { loadEmailCaptureQueues } from "../services/email-capture-queues";
import { aggregatePipelineResults } from "../services/email-capture-result";
import {
  createEmailCaptureFetchProgressHandler,
  type EmailCaptureFetchRun,
  isCurrentEmailCaptureFetchRun,
} from "../services/email-capture-store-runtime";
import { applyEmailCaptureFetchOutcome, type RefreshTransactions } from "./state";

type FetchAccountResultsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly fetchResults: readonly EmailAccountFetchResult[];
  readonly allEmails: Parameters<typeof ingestFetchedEmails>[0]["emails"];
  readonly onProgress: ReturnType<typeof createEmailCaptureFetchProgressHandler>;
  readonly parseProfile: EmailCaptureParseProfile;
};
type ProcessFetchResultInput = Omit<FetchAccountResultsInput, "fetchResults"> & {
  readonly fetchResult: EmailAccountFetchResult;
  readonly processed: readonly ProcessedEmailAccountFetchResult[];
};
type RefreshFetchOutcomeInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly run: EmailCaptureFetchRun;
  readonly showProgress: boolean;
  readonly syncPolicy: ReturnType<typeof resolveEmailCaptureSyncPolicy>;
  readonly processedFetchResults: readonly ProcessedEmailAccountFetchResult[];
  readonly refreshTransactions: RefreshTransactions;
};
type EmailCaptureQueues = Awaited<ReturnType<typeof loadEmailCaptureQueues>>;

function createFetchedEmailProgress(input: ProcessFetchResultInput) {
  const previous = aggregatePipelineResults(
    input.processed.map((result) => result.processingResult)
  );
  const completedBefore = input.processed.reduce(
    (completed, result) => completed + result.rawEmails.length,
    0
  );
  return (
    progress: Parameters<NonNullable<Parameters<typeof ingestFetchedEmails>[0]["onProgress"]>>[0]
  ) =>
    input.onProgress({
      total: input.allEmails.length,
      completed:
        completedBefore +
        (input.fetchResult.rawEmails.length - progress.total) +
        progress.completed,
      saved: previous.saved + progress.saved,
      failed: previous.failed + progress.failed,
      needsReview: previous.needsReview + progress.needsReview,
    });
}

async function processFetchedAccountResult(
  input: ProcessFetchResultInput
): Promise<ProcessedEmailAccountFetchResult> {
  const processingResult = await ingestFetchedEmails({
    db: input.db,
    userId: input.userId,
    emails: input.fetchResult.rawEmails,
    onProgress: createFetchedEmailProgress(input),
    runRetries: false,
    parseProfile: input.parseProfile,
  });
  return { ...input.fetchResult, processingResult };
}

export async function processFetchedAccountResults(
  input: FetchAccountResultsInput
): Promise<ProcessedEmailAccountFetchResult[]> {
  const processed: ProcessedEmailAccountFetchResult[] = [];

  for (const fetchResult of sortFetchResultsByNewestEmail(input.fetchResults)) {
    if (!fetchResult.fetchOk) continue;
    processed.push(
      await processFetchedAccountResult({
        db: input.db,
        userId: input.userId,
        fetchResult,
        processed,
        allEmails: input.allEmails,
        onProgress: input.onProgress,
        parseProfile: input.parseProfile,
      })
    );
  }

  return processed;
}

async function loadEmailCaptureQueuesWithFallback(
  db: AnyDb,
  userId: UserId
): Promise<EmailCaptureQueues | null> {
  return loadEmailCaptureQueues(db, userId).catch((error) => {
    captureWarning("email_capture_queue_refresh_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return null;
  });
}

async function createPersistedFetchAccounts(input: RefreshFetchOutcomeInput) {
  if (!input.syncPolicy.advancesLastFetchedAt) {
    return { fetchedAt: toIsoDateTime(new Date()), updatedAccountIds: new Set<EmailAccountId>() };
  }
  return persistFetchedAccounts({
    db: input.db,
    userId: input.userId,
    fetchResults: input.processedFetchResults,
  });
}

async function prepareCurrentFetchOutcome(input: RefreshFetchOutcomeInput) {
  const isCurrentRun = () => isCurrentEmailCaptureFetchRun(input.run);
  const persistedAccounts = await createPersistedFetchAccounts(input);
  if (!isCurrentRun()) return null;
  const queues = await loadEmailCaptureQueuesWithFallback(input.db, input.userId);
  return isCurrentRun() ? { persistedAccounts, queues } : null;
}

export async function refreshEmailCaptureQueuesAndOutcome(
  input: RefreshFetchOutcomeInput
): Promise<void> {
  const outcome = await prepareCurrentFetchOutcome(input);
  if (!outcome) return;
  await applyEmailCaptureFetchOutcome({
    run: input.run,
    showProgress: input.showProgress,
    persistedAccounts: outcome.persistedAccounts,
    queues: outcome.queues,
    refreshTransactions: input.refreshTransactions,
  });
}
