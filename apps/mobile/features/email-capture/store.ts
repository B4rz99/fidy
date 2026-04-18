import { eq } from "drizzle-orm";
import { create } from "zustand";
import { createCaptureIngestionPort } from "@/features/capture-sources/ingestion.public";
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
import { queryClient } from "@/shared/query";
import { assertEmailAccountId } from "@/shared/types/assertions";
import type { EmailAccountId, IsoDateTime, UserId } from "@/shared/types/branded";
import { insertMerchantRule } from "./lib/merchant-rules";
import type { ProgressPhase } from "./lib/progress-phases";
import { isFirstFetchForAny, shouldShowProgress } from "./lib/progress-phases";
import type { EmailAccountRow, ProcessedEmailRow } from "./lib/repository";
import {
  deleteEmailAccount,
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmails,
  getNeedsReviewEmails,
  insertEmailAccount,
  updateLastFetchedAt,
  updateProcessedEmailStatus,
} from "./lib/repository";
import type { ProgressCallback } from "./pipeline.public";
import { processEmails, processRetries } from "./pipeline.public";
import { ensureBankSenders } from "./queries/bank-senders";
import type { EmailProvider, RawEmail } from "./schema";
import { getAdapter } from "./services/email-adapter";

type ProgressSnapshot = Parameters<ProgressCallback>[0];
type RefreshTransactions = () => Promise<void> | void;

const EMPTY_RAW_EMAILS: RawEmail[] = [];
const COMPLETE_STATE_CLEAR_DELAY_MS = 2000;
const noopRefreshTransactions: RefreshTransactions = () => undefined;

let emailCaptureSessionId = 0;
let loadAccountsRequestId = 0;
let loadFailedEmailsRequestId = 0;
let loadNeedsReviewRequestId = 0;
let fetchAndProcessRequestId = 0;
let autoClearTimer: ReturnType<typeof setTimeout> | null = null;

type EmailCaptureState = {
  readonly activeUserId: UserId | null;
  readonly accounts: readonly EmailAccountRow[];
  readonly failedEmails: readonly ProcessedEmailRow[];
  readonly needsReviewEmails: readonly ProcessedEmailRow[];
  readonly isFetching: boolean;
  readonly progress: ProgressSnapshot | null;
  readonly phase: ProgressPhase | null;
  readonly bannerDismissed: boolean;
};

type EmailCaptureActions = {
  beginSession: (userId: UserId) => void;
  setAccounts: (accounts: readonly EmailAccountRow[]) => void;
  setFailedEmails: (failedEmails: readonly ProcessedEmailRow[]) => void;
  setNeedsReviewEmails: (needsReviewEmails: readonly ProcessedEmailRow[]) => void;
  setIsFetching: (isFetching: boolean) => void;
  setProgress: (progress: ProgressSnapshot | null) => void;
  setPhase: (phase: ProgressPhase | null) => void;
  dismissBanner: () => void;
  appendAccount: (account: EmailAccountRow) => void;
  removeAccount: (accountId: string) => void;
  removeFailedEmail: (processedEmailId: string) => void;
  removeNeedsReviewEmail: (processedEmailId: string) => void;
  markAccountsFetched: (accountIds: ReadonlySet<EmailAccountId>, fetchedAt: IsoDateTime) => void;
};

export const useEmailCaptureStore = create<EmailCaptureState & EmailCaptureActions>((set) => ({
  activeUserId: null,
  accounts: [],
  failedEmails: [],
  needsReviewEmails: [],
  isFetching: false,
  progress: null,
  phase: null,
  bannerDismissed: false,

  beginSession: (userId) =>
    set({
      activeUserId: userId,
      accounts: [],
      failedEmails: [],
      needsReviewEmails: [],
      isFetching: false,
      progress: null,
      phase: null,
      bannerDismissed: false,
    }),

  setAccounts: (accounts) => set({ accounts: [...accounts] }),

  setFailedEmails: (failedEmails) => set({ failedEmails: [...failedEmails] }),

  setNeedsReviewEmails: (needsReviewEmails) => set({ needsReviewEmails: [...needsReviewEmails] }),

  setIsFetching: (isFetching) => set({ isFetching }),

  setProgress: (progress) => set({ progress }),

  setPhase: (phase) => set({ phase }),

  dismissBanner: () => set({ bannerDismissed: true }),

  appendAccount: (account) => set((state) => ({ accounts: [...state.accounts, account] })),

  removeAccount: (accountId) =>
    set((state) => ({
      accounts: state.accounts.filter((account) => account.id !== accountId),
    })),

  removeFailedEmail: (processedEmailId) =>
    set((state) => ({
      failedEmails: state.failedEmails.filter((email) => email.id !== processedEmailId),
    })),

  removeNeedsReviewEmail: (processedEmailId) =>
    set((state) => ({
      needsReviewEmails: state.needsReviewEmails.filter((email) => email.id !== processedEmailId),
    })),

  markAccountsFetched: (accountIds, fetchedAt) =>
    set((state) => ({
      accounts: state.accounts.map((account) =>
        accountIds.has(account.id) ? { ...account, lastFetchedAt: fetchedAt } : account
      ),
    })),
}));

function clearAutoClearTimer(): void {
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }
}

function isActiveEmailCaptureSession(userId: UserId, sessionId: number): boolean {
  return (
    emailCaptureSessionId === sessionId && useEmailCaptureStore.getState().activeUserId === userId
  );
}

function isCurrentAccountsRequest(requestId: number, userId: UserId, sessionId: number): boolean {
  return loadAccountsRequestId === requestId && isActiveEmailCaptureSession(userId, sessionId);
}

function isCurrentFailedEmailsRequest(
  requestId: number,
  userId: UserId,
  sessionId: number
): boolean {
  return loadFailedEmailsRequestId === requestId && isActiveEmailCaptureSession(userId, sessionId);
}

function isCurrentNeedsReviewRequest(
  requestId: number,
  userId: UserId,
  sessionId: number
): boolean {
  return loadNeedsReviewRequestId === requestId && isActiveEmailCaptureSession(userId, sessionId);
}

function isCurrentFetchRun(requestId: number, userId: UserId, sessionId: number): boolean {
  return fetchAndProcessRequestId === requestId && isActiveEmailCaptureSession(userId, sessionId);
}

function setFetchState(input: {
  readonly isFetching?: boolean;
  readonly phase?: ProgressPhase | null;
  readonly progress?: ProgressSnapshot | null;
}): void {
  const state = useEmailCaptureStore.getState();
  if (input.isFetching !== undefined) {
    state.setIsFetching(input.isFetching);
  }
  if (input.phase !== undefined) {
    state.setPhase(input.phase);
  }
  if (input.progress !== undefined) {
    state.setProgress(input.progress);
  }
}

function completeFetchLater(requestId: number, userId: UserId, sessionId: number): void {
  clearAutoClearTimer();
  autoClearTimer = setTimeout(() => {
    autoClearTimer = null;
    if (
      isCurrentFetchRun(requestId, userId, sessionId) &&
      useEmailCaptureStore.getState().phase === "complete"
    ) {
      setFetchState({ phase: null, progress: null });
    }
  }, COMPLETE_STATE_CLEAR_DELAY_MS);
}

function warnFetchMissingContext(userId: UserId): void {
  const activeUserId = useEmailCaptureStore.getState().activeUserId;
  captureWarning("email_capture_fetch_missing_context", {
    hasActiveSession: activeUserId !== null,
    matchesActiveSession: activeUserId === userId,
    activeSessionUserId: activeUserId ?? "none",
  });
}

export function initializeEmailCaptureSession(userId: UserId): void {
  clearAutoClearTimer();
  emailCaptureSessionId += 1;
  loadAccountsRequestId += 1;
  loadFailedEmailsRequestId += 1;
  loadNeedsReviewRequestId += 1;
  fetchAndProcessRequestId += 1;
  useEmailCaptureStore.getState().beginSession(userId);
}

export async function loadEmailAccounts(db: AnyDb, userId: UserId): Promise<void> {
  const requestId = ++loadAccountsRequestId;
  const sessionId = emailCaptureSessionId;

  try {
    const accounts = await getEmailAccounts(db, userId);
    if (!isCurrentAccountsRequest(requestId, userId, sessionId)) return;
    useEmailCaptureStore.getState().setAccounts(accounts);
  } catch {
    // Keep existing state on account load failures.
  }
}

export async function loadFailedEmails(db: AnyDb, userId: UserId): Promise<void> {
  const requestId = ++loadFailedEmailsRequestId;
  const sessionId = emailCaptureSessionId;

  try {
    const failedEmails = await getFailedEmails(db);
    if (!isCurrentFailedEmailsRequest(requestId, userId, sessionId)) return;
    useEmailCaptureStore.getState().setFailedEmails(failedEmails);
  } catch {
    // Keep existing state on failed-email load failures.
  }
}

export async function loadNeedsReviewEmails(db: AnyDb, userId: UserId): Promise<void> {
  const requestId = ++loadNeedsReviewRequestId;
  const sessionId = emailCaptureSessionId;

  try {
    const needsReviewEmails = await getNeedsReviewEmails(db);
    if (!isCurrentNeedsReviewRequest(requestId, userId, sessionId)) return;
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
  const sessionId = emailCaptureSessionId;
  const failedEmail = useEmailCaptureStore
    .getState()
    .failedEmails.find((email) => email.id === processedEmailId);
  if (!failedEmail || !isActiveEmailCaptureSession(userId, sessionId)) return;

  await dismissProcessedEmail(db, failedEmail.id);
  if (!isActiveEmailCaptureSession(userId, sessionId)) return;
  useEmailCaptureStore.getState().removeFailedEmail(processedEmailId);
}

export async function connectEmailAccount(
  db: AnyDb,
  userId: UserId,
  provider: EmailProvider,
  clientId: string
): Promise<void> {
  const sessionId = emailCaptureSessionId;
  if (!isActiveEmailCaptureSession(userId, sessionId)) return;

  const result = await getAdapter(provider).connect(clientId);
  if (!result.success || !isActiveEmailCaptureSession(userId, sessionId)) return;

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
  if (!isActiveEmailCaptureSession(userId, sessionId)) return;
  useEmailCaptureStore.getState().appendAccount(row);
}

export async function disconnectEmailAccount(
  db: AnyDb,
  userId: UserId,
  emailAccountId: string
): Promise<void> {
  const sessionId = emailCaptureSessionId;
  if (!isActiveEmailCaptureSession(userId, sessionId)) return;

  const account = useEmailCaptureStore
    .getState()
    .accounts.find((candidate) => candidate.id === emailAccountId);
  if (account) {
    const provider = account.provider;
    if (provider === "gmail" || provider === "outlook") {
      await getAdapter(provider).disconnect();
      if (!isActiveEmailCaptureSession(userId, sessionId)) return;
    }

    await deleteEmailAccount(db, account.id);
    if (!isActiveEmailCaptureSession(userId, sessionId)) return;
    useEmailCaptureStore.getState().removeAccount(account.id);
    return;
  }

  assertEmailAccountId(emailAccountId);
  await deleteEmailAccount(db, emailAccountId);
  if (!isActiveEmailCaptureSession(userId, sessionId)) return;
  useEmailCaptureStore.getState().removeAccount(emailAccountId);
}

export async function fetchAndProcessEmails(
  db: AnyDb,
  userId: UserId,
  gmailClientId: string,
  outlookClientId: string,
  refreshTransactions: RefreshTransactions = noopRefreshTransactions
): Promise<void> {
  const sessionId = emailCaptureSessionId;
  if (!isActiveEmailCaptureSession(userId, sessionId)) {
    warnFetchMissingContext(userId);
    return;
  }
  if (useEmailCaptureStore.getState().isFetching) {
    captureWarning("email_capture_fetch_already_running");
    return;
  }

  const requestId = ++fetchAndProcessRequestId;
  clearAutoClearTimer();
  setFetchState({ isFetching: true, phase: null, progress: null });

  try {
    const accounts = useEmailCaptureStore.getState().accounts;
    if (accounts.length === 0) {
      captureWarning("email_capture_fetch_no_accounts");
      return;
    }

    const captureIngestion = createCaptureIngestionPort(db, {
      processEmails,
      processRetries,
    });
    const senders = await ensureBankSenders(queryClient);
    const senderEmails = senders.map((sender) => sender.email);

    const minSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const clientIds: Record<EmailProvider, string> = {
      gmail: gmailClientId,
      outlook: outlookClientId,
    };

    const fetchResults = await Promise.all(
      accounts.map(async (account) => {
        try {
          const provider = account.provider;
          if (provider !== "gmail" && provider !== "outlook") {
            return { account, rawEmails: EMPTY_RAW_EMAILS, fetchOk: false };
          }
          const since =
            account.lastFetchedAt && account.lastFetchedAt < minSince
              ? account.lastFetchedAt
              : minSince;
          const rawEmails = await getAdapter(provider).fetchEmails(
            clientIds[provider],
            since,
            senderEmails
          );
          return { account, rawEmails, fetchOk: true };
        } catch (error) {
          captureWarning("email_adapter_fetch_failed", {
            provider: account.provider,
            errorType: error instanceof Error ? error.message : "unknown",
          });
          return { account, rawEmails: EMPTY_RAW_EMAILS, fetchOk: false };
        }
      })
    );

    const allEmails = fetchResults.flatMap((result) => result.rawEmails);
    const isFirst = isFirstFetchForAny(accounts);
    const showProgress = shouldShowProgress(allEmails.length, isFirst);

    if (showProgress && allEmails.length === 0 && isCurrentFetchRun(requestId, userId, sessionId)) {
      setFetchState({
        phase: "complete",
        progress: { total: 0, completed: 0, saved: 0, failed: 0, needsReview: 0 },
      });
    } else if (showProgress && isCurrentFetchRun(requestId, userId, sessionId)) {
      useEmailCaptureStore.getState().setPhase("processing");
    }

    if (allEmails.length > 0) {
      let lastRefreshedSaved = 0;
      await captureIngestion.ingest({
        kind: "email_batch",
        userId,
        emails: allEmails,
        onProgress: (progress) => {
          if (!isCurrentFetchRun(requestId, userId, sessionId)) return;
          useEmailCaptureStore.getState().setProgress(progress);
          if (progress.saved > lastRefreshedSaved) {
            lastRefreshedSaved = progress.saved;
            void refreshTransactions();
          }
        },
      });
    }

    await captureIngestion.ingest({
      kind: "email_retry",
      userId,
    });

    const fetchedAt = toIsoDateTime(new Date());
    await Promise.all(
      fetchResults
        .filter((result) => result.fetchOk)
        .map((result) => updateLastFetchedAt(db, result.account.id, fetchedAt))
    );

    const updatedAccountIds = new Set(
      fetchResults.filter((result) => result.fetchOk).map((result) => result.account.id)
    );
    if (isCurrentFetchRun(requestId, userId, sessionId)) {
      useEmailCaptureStore.getState().markAccountsFetched(updatedAccountIds, fetchedAt);
    }

    const [failedEmails, needsReviewEmails] = await Promise.all([
      getFailedEmails(db),
      getNeedsReviewEmails(db),
    ]);

    if (isCurrentFetchRun(requestId, userId, sessionId)) {
      useEmailCaptureStore.getState().setFailedEmails(failedEmails);
      useEmailCaptureStore.getState().setNeedsReviewEmails(needsReviewEmails);
      if (showProgress) {
        useEmailCaptureStore.getState().setPhase("complete");
      }
      await refreshTransactions();
    }
  } catch (error) {
    captureError(error);
  } finally {
    if (isCurrentFetchRun(requestId, userId, sessionId)) {
      const currentPhase = useEmailCaptureStore.getState().phase;
      if (currentPhase !== "complete") {
        setFetchState({ isFetching: false, progress: null, phase: null });
      } else {
        useEmailCaptureStore.getState().setIsFetching(false);
        completeFetchLater(requestId, userId, sessionId);
      }
    }
  }
}

export async function confirmReviewedEmail(
  db: AnyDb,
  userId: UserId,
  processedEmailId: string,
  categoryId: string,
  refreshTransactions: RefreshTransactions = noopRefreshTransactions
): Promise<void> {
  const sessionId = emailCaptureSessionId;
  if (!isActiveEmailCaptureSession(userId, sessionId)) return;

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

  await updateProcessedEmailStatus(db, processedEmail.id, "success", processedEmail.transactionId);
  if (!isActiveEmailCaptureSession(userId, sessionId)) return;

  useEmailCaptureStore.getState().removeNeedsReviewEmail(processedEmailId);
  await refreshTransactions();
}
