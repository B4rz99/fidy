import type { AnyDb } from "@/shared/db";
import { captureError, captureWarning, generateEmailAccountId, toIsoDateTime } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import type { EmailAccountRow } from "./lib/repository";
import {
  deleteEmailAccount,
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmails,
  getNeedsReviewEmails,
  insertEmailAccount,
} from "./lib/repository";
import type { EmailProvider } from "./schema";
import { getAdapter } from "./services/email-adapter";
import {
  aggregatePipelineResults,
  createEmailFetchClientIds,
  fetchEmailAccountBatch,
  ingestFetchedEmails,
  loadEmailCaptureQueues,
  type ProcessedEmailAccountFetchResult,
  persistFetchedAccounts,
} from "./services/email-capture-fetch-service";
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
  isManagedEmailProvider,
  type RefreshTransactions,
  resolveEmailAccountId,
  useEmailCaptureStore,
  warnFetchMissingContext,
} from "./store/state";

export { confirmReviewedEmail } from "./store/reviewed-email";

const noopRefreshTransactions: RefreshTransactions = () => undefined;

export type EmailCaptureFetchOutcome =
  | {
      readonly status: "completed";
      readonly savedCount: number;
      readonly needsReviewCount: number;
      readonly failedCount: number;
    }
  | { readonly status: "skipped" };

const EMPTY_FETCH_OUTCOME: EmailCaptureFetchOutcome = {
  status: "completed",
  savedCount: 0,
  needsReviewCount: 0,
  failedCount: 0,
};

const SKIPPED_FETCH_OUTCOME: EmailCaptureFetchOutcome = { status: "skipped" };

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
  } catch {
    // Keep existing state on account load failures.
  }
}

export async function loadFailedEmails(db: AnyDb, userId: UserId): Promise<void> {
  const request = beginEmailCaptureRequest("failedEmails", userId);

  try {
    const failedEmails = await getFailedEmails(db);
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setFailedEmails(failedEmails);
  } catch {
    // Keep existing state on failed-email load failures.
  }
}

export async function loadNeedsReviewEmails(db: AnyDb, userId: UserId): Promise<void> {
  const request = beginEmailCaptureRequest("needsReview", userId);

  try {
    const needsReviewEmails = await getNeedsReviewEmails(db);
    if (!isCurrentEmailCaptureRequest(request)) return;
    useEmailCaptureStore.getState().setNeedsReviewEmails(needsReviewEmails);
  } catch {
    // Keep existing state on needs-review load failures.
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

export async function connectEmailAccount(
  db: AnyDb,
  userId: UserId,
  provider: EmailProvider,
  clientId: string
): Promise<void> {
  const session = createEmailCaptureSession(userId);
  if (!isActiveEmailCaptureSession(session)) return;

  const result = await getAdapter(provider).connect(clientId);
  if (!result.success || !isActiveEmailCaptureSession(session)) return;

  const alreadyConnected = useEmailCaptureStore
    .getState()
    .accounts.some((account) => account.email.toLowerCase() === result.email.toLowerCase());
  if (alreadyConnected) return;

  const row: EmailAccountRow = {
    id: generateEmailAccountId(),
    userId,
    provider,
    email: result.email,
    lastFetchedAt: null,
    createdAt: toIsoDateTime(new Date()),
  };

  await insertEmailAccount(db, row);
  if (!isActiveEmailCaptureSession(session)) return;
  useEmailCaptureStore.getState().appendAccount(row);
}

export async function disconnectEmailAccount(
  db: AnyDb,
  userId: UserId,
  emailAccountId: string
): Promise<void> {
  const session = createEmailCaptureSession(userId);
  if (!isActiveEmailCaptureSession(session)) return;

  const account = useEmailCaptureStore
    .getState()
    .accounts.find((candidate) => candidate.id === emailAccountId);
  const accountId = resolveEmailAccountId(account, emailAccountId);
  if (isManagedEmailProvider(account?.provider)) {
    await getAdapter(account.provider).disconnect();
    if (!isActiveEmailCaptureSession(session)) return;
  }

  await deleteEmailAccount(db, accountId);
  if (!isActiveEmailCaptureSession(session)) return;
  useEmailCaptureStore.getState().removeAccount(accountId);
}

export async function fetchAndProcessEmails(
  db: AnyDb,
  userId: UserId,
  gmailClientId: string,
  outlookClientId: string,
  refreshTransactions: RefreshTransactions = noopRefreshTransactions
): Promise<EmailCaptureFetchOutcome> {
  const fetchStart = beginEmailCaptureFetchRun(userId);
  if (fetchStart.kind === "missing_context") {
    warnFetchMissingContext(userId);
    return SKIPPED_FETCH_OUTCOME;
  }
  if (fetchStart.kind === "already_fetching") {
    captureWarning("email_capture_fetch_already_running");
    return SKIPPED_FETCH_OUTCOME;
  }

  const run = fetchStart.run;

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
    applyEmailCaptureFetchSummary({
      run,
      showProgress: summary.showProgress,
      emailCount: summary.allEmails.length,
    });
    const onProgress = createEmailCaptureFetchProgressHandler(run, refreshTransactions);
    const processedFetchResults = await summary.fetchResults.reduce(
      async (processedPromise, fetchResult) => {
        const processed = await processedPromise;
        if (!fetchResult.fetchOk) return processed;

        const processingResult = await ingestFetchedEmails({
          db,
          userId,
          emails: fetchResult.rawEmails,
          onProgress,
          runRetries: false,
        });

        return [...processed, { ...fetchResult, processingResult }];
      },
      Promise.resolve([] as ProcessedEmailAccountFetchResult[])
    );
    await ingestFetchedEmails({ db, userId, emails: [] });
    const processingResult = aggregatePipelineResults(
      processedFetchResults.map((result) => result.processingResult)
    );

    await applyEmailCaptureFetchOutcome({
      run,
      showProgress: summary.showProgress,
      persistedAccounts: await persistFetchedAccounts({
        db,
        fetchResults: processedFetchResults,
      }),
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
