import type { AnyDb } from "@/shared/db";
import { captureError, captureWarning, toIsoDateTime } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import {
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmailSourceEvents,
  getFailedEmails,
  getNeedsReviewEmailSourceEvents,
  getNeedsReviewEmails,
  updateProcessedSourceEventStatus,
} from "./lib/repository";
import { shareEmailParseImprovementRequests } from "./services/email-parse-improvement-sharing";
import {
  applyEmailCaptureCandidateLimit,
  createEmailFetchClientIds,
  type EmailCaptureParseProfile,
  fetchEmailAccountBatch,
  ingestFetchedEmails,
  type ProcessedEmailAccountFetchResult,
  persistFetchedAccounts,
  resolveEmailCaptureSyncPolicy,
  sortFetchResultsByNewestEmail,
} from "./services/email-capture-fetch-service";
import { loadEmailCaptureQueues } from "./services/email-capture-queues";
import { aggregatePipelineResults } from "./services/email-capture-result";
import {
  applyEmailCaptureFetchSummary,
  beginEmailCaptureFetchRun,
  beginEmailCaptureRequest,
  createEmailCaptureFetchProgressHandler,
  createEmailCaptureSession,
  finalizeEmailCaptureFetchRun,
  initializeEmailCaptureStoreSession,
  isActiveEmailCaptureSession,
  isCurrentEmailCaptureRequest,
  registerEmailCaptureStoreRuntime,
} from "./services/email-capture-store-runtime";
import {
  applyEmailCaptureFetchOutcome,
  type RefreshTransactions,
  useEmailCaptureStore,
  warnFetchMissingContext,
} from "./store/state";
export { confirmReviewedEmail } from "./store/reviewed-email";
export { connectEmailAccount, disconnectEmailAccount } from "./store/account-actions";
const noopRefreshTransactions: RefreshTransactions = () => undefined;
export type EmailCaptureFetchOutcome =
  | {
      readonly status: "completed";
      readonly savedCount: number;
      readonly needsReviewCount: number;
      readonly failedCount: number;
    }
  | { readonly status: "skipped"; readonly reason: "already_fetching" | "missing_context" };
const EMPTY_FETCH_OUTCOME: EmailCaptureFetchOutcome = {
  status: "completed",
  savedCount: 0,
  needsReviewCount: 0,
  failedCount: 0,
};
const alreadyFetchingOutcome: EmailCaptureFetchOutcome = {
  status: "skipped",
  reason: "already_fetching",
};
const missingContextOutcome: EmailCaptureFetchOutcome = {
  status: "skipped",
  reason: "missing_context",
};
export { useEmailCaptureStore };
registerEmailCaptureStoreRuntime({
  beginSession: (userId) => useEmailCaptureStore.getState().beginSession(userId),
  getActiveUserId: () => useEmailCaptureStore.getState().activeUserId,
  getIsFetching: () => useEmailCaptureStore.getState().isFetching,
  getPhase: () => useEmailCaptureStore.getState().phase,
  setIsFetching: (isFetching) => useEmailCaptureStore.getState().setIsFetching(isFetching),
  setPhase: (phase) => useEmailCaptureStore.getState().setPhase(phase),
  setProgress: (progress) => useEmailCaptureStore.getState().setProgress(progress),
});
export function initializeEmailCaptureSession(userId: UserId): void {
  initializeEmailCaptureStoreSession(userId);
}
export async function loadEmailAccounts(db: AnyDb, userId: UserId) {
  const request = beginEmailCaptureRequest("accounts", userId);
  try {
    const accounts = await getEmailAccounts(db, userId);
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setAccounts(accounts);
  } catch {}
}
export async function loadFailedEmails(db: AnyDb, userId: UserId) {
  const request = beginEmailCaptureRequest("failedEmails", userId);
  const [failedEmailsResult, sourceEventsResult] = await Promise.allSettled([
    getFailedEmails(db),
    getFailedEmailSourceEvents(db, userId),
  ]);
  if (!isCurrentEmailCaptureRequest(request)) return;
  if (failedEmailsResult.status === "fulfilled") {
    useEmailCaptureStore.getState().setFailedEmails(failedEmailsResult.value);
  } else {
    useEmailCaptureStore.getState().setFailedEmails([]);
    captureWarning("email_capture_failed_queue_load_failed", {
      errorType:
        failedEmailsResult.reason instanceof Error ? failedEmailsResult.reason.name : "unknown",
    });
  }
  if (sourceEventsResult.status === "fulfilled") {
    useEmailCaptureStore.getState().setFailedEmailSourceEvents(sourceEventsResult.value);
  } else {
    useEmailCaptureStore.getState().setFailedEmailSourceEvents([]);
    captureWarning("email_capture_failed_source_event_queue_load_failed", {
      errorType:
        sourceEventsResult.reason instanceof Error ? sourceEventsResult.reason.name : "unknown",
    });
  }
}
export async function loadNeedsReviewEmails(db: AnyDb, userId: UserId) {
  const request = beginEmailCaptureRequest("needsReview", userId);
  const [needsReviewEmailsResult, sourceEventsResult] = await Promise.allSettled([
    getNeedsReviewEmails(db),
    getNeedsReviewEmailSourceEvents(db, userId),
  ]);
  if (!isCurrentEmailCaptureRequest(request)) return;
  if (needsReviewEmailsResult.status === "fulfilled") {
    useEmailCaptureStore.getState().setNeedsReviewEmails(needsReviewEmailsResult.value);
  } else {
    captureWarning("email_capture_needs_review_queue_load_failed", {
      errorType:
        needsReviewEmailsResult.reason instanceof Error
          ? needsReviewEmailsResult.reason.name
          : "unknown",
    });
  }
  if (sourceEventsResult.status === "fulfilled") {
    useEmailCaptureStore.getState().setNeedsReviewEmailSourceEvents(sourceEventsResult.value);
  } else {
    captureWarning("email_capture_needs_review_source_event_queue_load_failed", {
      errorType:
        sourceEventsResult.reason instanceof Error ? sourceEventsResult.reason.name : "unknown",
    });
  }
}
export async function dismissFailedEmail(
  db: AnyDb,
  userId: UserId,
  processedEmailId: string
): Promise<void> {
  const session = createEmailCaptureSession(userId);
  const failedEmail = useEmailCaptureStore
    .getState()
    .failedEmails.find((email) => email.id === processedEmailId);
  if (!failedEmail || !isActiveEmailCaptureSession(session)) return;
  await dismissProcessedEmail(db, failedEmail.id);
  if (!isActiveEmailCaptureSession(session)) return;
  useEmailCaptureStore.getState().removeFailedEmail(processedEmailId);
}
export async function dismissFailedEmailSourceEvent(
  db: AnyDb,
  userId: UserId,
  processedSourceEventId: string
): Promise<void> {
  const session = createEmailCaptureSession(userId);
  const failedEvent = useEmailCaptureStore
    .getState()
    .failedEmailSourceEvents.find((event) => event.id === processedSourceEventId);
  if (!failedEvent || !isActiveEmailCaptureSession(session)) return;
  await updateProcessedSourceEventStatus({
    db,
    id: failedEvent.id,
    status: "dismissed",
    transactionId: null,
  });
  if (!isActiveEmailCaptureSession(session)) return;
  useEmailCaptureStore.getState().removeFailedEmail(processedSourceEventId);
}
export async function fetchAndProcessEmails(
  db: AnyDb,
  userId: UserId,
  gmailClientId: string,
  outlookClientId: string,
  refreshTransactions: RefreshTransactions = noopRefreshTransactions,
  options: {
    readonly parseProfile?: EmailCaptureParseProfile;
    readonly shareParseImprovementSamples?: boolean;
  } = {}
): Promise<EmailCaptureFetchOutcome> {
  const fetchStart = beginEmailCaptureFetchRun(userId);
  if (fetchStart.kind === "missing_context") {
    warnFetchMissingContext(userId);
    return missingContextOutcome;
  }
  if (fetchStart.kind === "already_fetching") {
    captureWarning("email_capture_fetch_already_running");
    return alreadyFetchingOutcome;
  }
  const run = fetchStart.run;
  const syncPolicy = resolveEmailCaptureSyncPolicy(options.parseProfile);
  try {
    const accounts = useEmailCaptureStore.getState().accounts;
    if (accounts.length === 0) {
      captureWarning("email_capture_fetch_no_accounts");
      return EMPTY_FETCH_OUTCOME;
    }
    const summary = await fetchEmailAccountBatch({
      accounts,
      clientIds: createEmailFetchClientIds(gmailClientId, outlookClientId),
    });
    const fetchResults = applyEmailCaptureCandidateLimit(
      summary.fetchResults,
      syncPolicy.maxCandidateEmails
    );
    const allEmails = fetchResults.flatMap((result) => result.rawEmails);
    const showProgress = syncPolicy.showsProgress && summary.showProgress;
    applyEmailCaptureFetchSummary({
      run,
      showProgress,
      emailCount: allEmails.length,
    });
    const onProgress = createEmailCaptureFetchProgressHandler(run, refreshTransactions);
    const processedFetchResults = await sortFetchResultsByNewestEmail(fetchResults).reduce(
      async (processedPromise, fetchResult) => {
        const processed = await processedPromise;
        if (!fetchResult.fetchOk) return processed;
        const previousResult = aggregatePipelineResults(
          processed.map((result) => result.processingResult)
        );
        const completedBefore = processed.reduce(
          (completed, result) => completed + result.rawEmails.length,
          0
        );
        const processingResult = await ingestFetchedEmails({
          db,
          userId,
          emails: fetchResult.rawEmails,
          onProgress: (progress) =>
            onProgress({
              total: allEmails.length,
              completed: completedBefore + progress.completed,
              saved: previousResult.saved + progress.saved,
              failed: previousResult.failed + progress.failed,
              needsReview: previousResult.needsReview + progress.needsReview,
            }),
          runRetries: false,
          parseProfile: syncPolicy.parseProfile,
        });
        return [...processed, { ...fetchResult, processingResult }];
      },
      Promise.resolve([] as ProcessedEmailAccountFetchResult[])
    );
    if (syncPolicy.runRetries) {
      await ingestFetchedEmails({ db, userId, emails: [], parseProfile: syncPolicy.parseProfile });
    }
    const processingResult = aggregatePipelineResults(
      processedFetchResults.map((result) => result.processingResult)
    );
    await shareEmailParseImprovementRequests({
      enabled: options.shareParseImprovementSamples === true,
      userId,
      requests: processingResult.parseImprovementRequests,
    });
    const queues = await loadEmailCaptureQueues(db, userId).catch((error) => {
      captureWarning("email_capture_queue_refresh_failed", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
      const currentQueues = useEmailCaptureStore.getState();
      return {
        failedEmails: [...currentQueues.failedEmails],
        failedEmailSourceEvents: [...currentQueues.failedEmailSourceEvents],
        needsReviewEmails: [...currentQueues.needsReviewEmails],
        needsReviewEmailSourceEvents: [...currentQueues.needsReviewEmailSourceEvents],
      };
    });
    await applyEmailCaptureFetchOutcome({
      run,
      showProgress,
      persistedAccounts: syncPolicy.advancesLastFetchedAt
        ? await persistFetchedAccounts({
            db,
            userId,
            fetchResults: processedFetchResults,
          })
        : { fetchedAt: toIsoDateTime(new Date()), updatedAccountIds: new Set() },
      queues,
      refreshTransactions,
    });
    return {
      status: "completed",
      savedCount: processingResult.saved,
      needsReviewCount: processingResult.needsReview,
      failedCount: processingResult.failed,
    };
  } catch (error) {
    captureError(error);
    return EMPTY_FETCH_OUTCOME;
  } finally {
    finalizeEmailCaptureFetchRun(run);
  }
}
