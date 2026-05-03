import type { AnyDb } from "@/shared/db";
import { captureError, captureWarning, toIsoDateTime } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import {
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmails,
  getNeedsReviewEmails,
} from "./lib/repository";
import { shareEmailParseImprovementRequests } from "./services/email-parse-improvement-sharing";
import {
  applyEmailCaptureCandidateLimit,
  createEmailFetchClientIds,
  type EmailCaptureParseProfile,
  fetchEmailAccountBatch,
  ingestFetchedEmails,
  loadEmailCaptureQueues,
  type ProcessedEmailAccountFetchResult,
  persistFetchedAccounts,
  resolveEmailCaptureSyncPolicy,
  sortFetchResultsByNewestEmail,
} from "./services/email-capture-fetch-service";
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
export async function loadEmailAccounts(db: AnyDb, userId: UserId): Promise<void> {
  const request = beginEmailCaptureRequest("accounts", userId);

  try {
    const accounts = await getEmailAccounts(db, userId);
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setAccounts(accounts);
  } catch {}
}
export async function loadFailedEmails(db: AnyDb, userId: UserId): Promise<void> {
  const request = beginEmailCaptureRequest("failedEmails", userId);

  try {
    const failedEmails = await getFailedEmails(db);
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setFailedEmails(failedEmails);
  } catch {}
}
export async function loadNeedsReviewEmails(db: AnyDb, userId: UserId): Promise<void> {
  const request = beginEmailCaptureRequest("needsReview", userId);

  try {
    const needsReviewEmails = await getNeedsReviewEmails(db);
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setNeedsReviewEmails(needsReviewEmails);
  } catch {}
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

    await applyEmailCaptureFetchOutcome({
      run,
      showProgress,
      persistedAccounts: syncPolicy.advancesLastFetchedAt
        ? await persistFetchedAccounts({
            db,
            fetchResults: processedFetchResults,
          })
        : { fetchedAt: toIsoDateTime(new Date()), updatedAccountIds: new Set() },
      queues: await loadEmailCaptureQueues(db),
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
