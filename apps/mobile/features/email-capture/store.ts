import { eq } from "drizzle-orm";
import { isValidCategoryId } from "@/features/transactions/write.public";
import type { AnyDb } from "@/shared/db";
import { enqueueSync, transactions } from "@/shared/db";
import {
  captureError,
  captureWarning,
  generateEmailAccountId,
  generateSyncQueueId,
  normalizeMerchant,
  toIsoDateTime,
} from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { insertMerchantRule } from "./lib/merchant-rules";
import type { EmailAccountRow } from "./lib/repository";
import {
  deleteEmailAccount,
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmails,
  getNeedsReviewEmails,
  insertEmailAccount,
  updateProcessedEmailStatus,
} from "./lib/repository";
import type { EmailProvider } from "./schema";
import { getAdapter } from "./services/email-adapter";
import {
  createEmailFetchClientIds,
  fetchEmailAccountBatch,
  ingestFetchedEmails,
  loadEmailCaptureQueues,
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

const noopRefreshTransactions: RefreshTransactions = () => undefined;

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
): Promise<void> {
  const fetchStart = beginEmailCaptureFetchRun(userId);
  if (fetchStart.kind === "missing_context") {
    warnFetchMissingContext(userId);
    return;
  }
  if (fetchStart.kind === "already_fetching") {
    captureWarning("email_capture_fetch_already_running");
    return;
  }

  const run = fetchStart.run;

  try {
    const accounts = useEmailCaptureStore.getState().accounts;
    if (accounts.length === 0) {
      captureWarning("email_capture_fetch_no_accounts");
      return;
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
    await ingestFetchedEmails({
      db,
      userId,
      emails: summary.allEmails,
      onProgress: createEmailCaptureFetchProgressHandler(run, refreshTransactions),
    });

    await applyEmailCaptureFetchOutcome({
      run,
      showProgress: summary.showProgress,
      persistedAccounts: await persistFetchedAccounts({ db, fetchResults: summary.fetchResults }),
      queues: await loadEmailCaptureQueues(db),
      refreshTransactions,
    });
  } catch (error) {
    captureError(error);
  } finally {
    finalizeEmailCaptureFetchRun(run);
  }
}

export async function confirmReviewedEmail(
  db: AnyDb,
  userId: UserId,
  processedEmailId: string,
  categoryId: string,
  refreshTransactions: RefreshTransactions = noopRefreshTransactions
): Promise<void> {
  const session = createEmailCaptureSession(userId);
  if (!isActiveEmailCaptureSession(session)) return;

  const processedEmail = useEmailCaptureStore
    .getState()
    .needsReviewEmails.find((email) => email.id === processedEmailId);
  if (!processedEmail?.transactionId || !isValidCategoryId(categoryId)) return;

  const now = toIsoDateTime(new Date());

  await db
    .update(transactions)
    .set({ categoryId, updatedAt: now })
    .where(eq(transactions.id, processedEmail.transactionId));

  enqueueSync(db, {
    id: generateSyncQueueId(),
    tableName: "transactions",
    rowId: processedEmail.transactionId,
    operation: "update",
    createdAt: now,
  });

  const txRows = await db
    .select({ description: transactions.description })
    .from(transactions)
    .where(eq(transactions.id, processedEmail.transactionId));
  const description = txRows[0]?.description;
  if (description) {
    const merchantKey = normalizeMerchant(description);
    await insertMerchantRule(db, userId, merchantKey, categoryId, now);
  }

  await updateProcessedEmailStatus({
    db,
    id: processedEmail.id,
    status: "success",
    transactionId: processedEmail.transactionId,
  });
  if (!isActiveEmailCaptureSession(session)) return;

  useEmailCaptureStore.getState().removeNeedsReviewEmail(processedEmailId);
  await refreshTransactions();
}
