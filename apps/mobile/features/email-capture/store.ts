import type { AnyDb } from "@/shared/db";
import { captureError, captureWarning } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import {
  getEmailAccounts,
  getFailedEmailSourceEvents,
  getNeedsReviewEmailSourceEvents,
  updateProcessedSourceEventStatus,
} from "./lib/repository";
import { shareEmailParseImprovementRequests } from "./services/email-parse-improvement-sharing";
import {
  applyEmailCaptureCandidateLimit,
  createEmailFetchClientIds,
  type EmailCaptureParseProfile,
  fetchEmailAccountBatch,
  ingestFetchedEmails,
  resolveEmailCaptureSyncPolicy,
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
  processFetchedAccountResults,
  refreshEmailCaptureQueuesAndOutcome,
} from "./store/fetch-processing";
import {
  type RefreshTransactions,
  useEmailCaptureStore,
  warnFetchMissingContext,
} from "./store/state";
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

  try {
    const failedEmailSourceEvents = await getFailedEmailSourceEvents(db, userId);
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setFailedEmailSourceEvents(failedEmailSourceEvents);
  } catch (error) {
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setFailedEmailSourceEvents([]);
    captureWarning("email_capture_failed_queue_load_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
}
export async function loadNeedsReviewEmails(db: AnyDb, userId: UserId) {
  const request = beginEmailCaptureRequest("needsReview", userId);

  try {
    const needsReviewEmailSourceEvents = await getNeedsReviewEmailSourceEvents(db, userId);
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setNeedsReviewEmailSourceEvents(needsReviewEmailSourceEvents);
  } catch (error) {
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setNeedsReviewEmailSourceEvents([]);
    captureWarning("email_capture_needs_review_queue_load_failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
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
    readonly isShareParseImprovementSamplesEnabled?: () => boolean;
    readonly canDeleteDisabledParseImprovementSamples?: () => boolean;
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
    const processedFetchResults = await processFetchedAccountResults({
      db,
      userId,
      fetchResults,
      allEmails,
      onProgress,
      parseProfile: syncPolicy.parseProfile,
    });
    if (syncPolicy.runRetries) {
      await ingestFetchedEmails({ db, userId, emails: [], parseProfile: syncPolicy.parseProfile });
    }
    const processingResult = aggregatePipelineResults(
      processedFetchResults.map((result) => result.processingResult)
    );
    await shareEmailParseImprovementRequests({
      db,
      enabled: options.shareParseImprovementSamples === true,
      userId,
      requests: processingResult.parseImprovementRequests,
      isSharingEnabled: options.isShareParseImprovementSamplesEnabled,
      canDeleteDisabledSamples: options.canDeleteDisabledParseImprovementSamples,
    });
    await refreshEmailCaptureQueuesAndOutcome({
      db,
      userId,
      run,
      showProgress,
      syncPolicy,
      processedFetchResults,
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
