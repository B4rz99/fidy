import { eq } from "drizzle-orm";
import { create } from "zustand";
import { createCaptureIngestionPort } from "@/features/capture-sources/ingestion.public";
import { useTransactionStore } from "@/features/transactions";
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
import { assertEmailAccountId, assertUserId } from "@/shared/types/assertions";
import type { UserId } from "@/shared/types/branded";
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

let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;
let autoClearTimer: ReturnType<typeof setTimeout> | null = null;
const EMPTY_RAW_EMAILS: RawEmail[] = [];

type EmailCaptureState = {
  accounts: EmailAccountRow[];
  failedEmails: ProcessedEmailRow[];
  needsReviewEmails: ProcessedEmailRow[];
  isFetching: boolean;
  progress: Parameters<ProgressCallback>[0] | null;
  phase: ProgressPhase | null;
  bannerDismissed: boolean;
};

type EmailCaptureActions = {
  initStore: (db: AnyDb, userId: string) => void;
  loadAccounts: () => Promise<void>;
  loadFailedEmails: () => Promise<void>;
  loadNeedsReview: () => Promise<void>;
  dismissBanner: () => void;
  dismissFailedEmail: (id: string) => Promise<void>;
  connectEmail: (provider: EmailProvider, clientId: string) => Promise<void>;
  disconnectEmail: (id: string) => Promise<void>;
  fetchAndProcess: (gmailClientId: string, outlookClientId: string) => Promise<void>;
  confirmReview: (processedEmailId: string, categoryId: string) => Promise<void>;
};

export const useEmailCaptureStore = create<EmailCaptureState & EmailCaptureActions>((set, get) => ({
  accounts: [],
  failedEmails: [],
  needsReviewEmails: [],
  isFetching: false,
  progress: null,
  phase: null,
  bannerDismissed: false,

  initStore: (db, userId) => {
    dbRef = db;
    if (typeof userId !== "string" || userId.trim().length === 0) {
      userIdRef = null;
      return;
    }
    assertUserId(userId);
    userIdRef = userId;
  },

  loadAccounts: async () => {
    if (!dbRef || !userIdRef) return;
    const accounts = await getEmailAccounts(dbRef, userIdRef);
    set({ accounts });
  },

  loadFailedEmails: async () => {
    if (!dbRef) return;
    const failedEmails = await getFailedEmails(dbRef);
    set({ failedEmails });
  },

  loadNeedsReview: async () => {
    if (!dbRef) return;
    const needsReviewEmails = await getNeedsReviewEmails(dbRef);
    set({ needsReviewEmails });
  },

  dismissBanner: () => set({ bannerDismissed: true }),

  dismissFailedEmail: async (id) => {
    if (!dbRef) return;
    const failedEmail = get().failedEmails.find((email) => email.id === id);
    if (!failedEmail) return;
    await dismissProcessedEmail(dbRef, failedEmail.id);
    const updated = get().failedEmails.filter((e) => e.id !== id);
    set({ failedEmails: updated });
  },

  connectEmail: async (provider, clientId) => {
    if (!dbRef || !userIdRef) return;

    const result = await getAdapter(provider).connect(clientId);

    if (!result.success) return;

    // Prevent connecting the same email address twice
    const alreadyConnected = get().accounts.some(
      (a) => a.email.toLowerCase() === result.email.toLowerCase()
    );
    if (alreadyConnected) return;

    const row: EmailAccountRow = {
      id: generateEmailAccountId(),
      userId: userIdRef,
      provider,
      email: result.email,
      lastFetchedAt: null,
      createdAt: toIsoDateTime(new Date()),
    };

    await insertEmailAccount(dbRef, row);
    set((state) => ({ accounts: [...state.accounts, row] }));
  },

  disconnectEmail: async (id) => {
    if (!dbRef) return;
    const account = get().accounts.find((a) => a.id === id);
    if (account) {
      const provider = account.provider;
      if (provider === "gmail" || provider === "outlook") {
        await getAdapter(provider).disconnect();
      }
      await deleteEmailAccount(dbRef, account.id);
      set((state) => ({
        accounts: state.accounts.filter((a) => a.id !== id),
      }));
      return;
    }
    assertEmailAccountId(id);
    await deleteEmailAccount(dbRef, id);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    }));
  },

  fetchAndProcess: async (gmailClientId, outlookClientId) => {
    const db = dbRef;
    const userId = userIdRef;
    if (!db || !userId) {
      captureWarning("email_capture_fetch_missing_context", {
        hasDb: Boolean(db),
        hasUserId: Boolean(userId),
      });
      return;
    }
    if (get().isFetching) {
      captureWarning("email_capture_fetch_already_running");
      return;
    }

    // Clear any stale progress/timer from a previous run
    if (autoClearTimer) {
      clearTimeout(autoClearTimer);
      autoClearTimer = null;
    }
    set({ isFetching: true, phase: null, progress: null });

    try {
      const captureIngestion = createCaptureIngestionPort(db, {
        processEmails,
        processRetries,
      });
      const { accounts } = get();
      if (accounts.length === 0) {
        captureWarning("email_capture_fetch_no_accounts");
        return;
      }

      const senders = await ensureBankSenders(queryClient);
      const senderEmails = senders.map((s) => s.email);

      // Always look back at least 30 days; dedup by externalId prevents re-processing
      const minSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const clientIds: Record<EmailProvider, string> = {
        gmail: gmailClientId,
        outlook: outlookClientId,
      };

      // Fetch emails from all accounts in parallel
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
          } catch (err) {
            captureWarning("email_adapter_fetch_failed", {
              provider: account.provider,
              errorType: err instanceof Error ? err.message : "unknown",
            });
            return { account, rawEmails: EMPTY_RAW_EMAILS, fetchOk: false };
          }
        })
      );

      const allEmails = fetchResults.flatMap((r) => r.rawEmails);

      // Determine whether to show progress UI
      const isFirst = isFirstFetchForAny(accounts);
      const showProgress = shouldShowProgress(allEmails.length, isFirst);

      // Edge case: first fetch but zero emails found
      if (showProgress && allEmails.length === 0) {
        set({
          phase: "complete",
          progress: { total: 0, completed: 0, saved: 0, failed: 0, needsReview: 0 },
        });
      } else if (showProgress) {
        set({ phase: "processing" });

        let lastRefreshedSaved = 0;
        await captureIngestion.ingest({
          kind: "email_batch",
          userId,
          emails: allEmails,
          onProgress: (progress) => {
            set({ progress });
            if (progress.saved > lastRefreshedSaved) {
              lastRefreshedSaved = progress.saved;
              void useTransactionStore.getState().refresh();
            }
          },
        });
      } else if (allEmails.length > 0) {
        // Silent processing — no progress UI
        let lastRefreshedSaved = 0;
        await captureIngestion.ingest({
          kind: "email_batch",
          userId,
          emails: allEmails,
          onProgress: (progress) => {
            set({ progress });
            if (progress.saved > lastRefreshedSaved) {
              lastRefreshedSaved = progress.saved;
              void useTransactionStore.getState().refresh();
            }
          },
        });
      }

      await captureIngestion.ingest({
        kind: "email_retry",
        userId,
      });

      // Update lastFetchedAt only for accounts whose fetch succeeded
      const now = toIsoDateTime(new Date());
      await Promise.all(
        fetchResults.filter((r) => r.fetchOk).map((r) => updateLastFetchedAt(db, r.account.id, now))
      );

      // Update in-memory accounts to prevent stale lastFetchedAt
      const successIds = new Set(fetchResults.filter((r) => r.fetchOk).map((r) => r.account.id));
      set({
        accounts: get().accounts.map((a) =>
          successIds.has(a.id) ? { ...a, lastFetchedAt: now } : a
        ),
      });

      const [failedEmails, needsReviewEmails] = await Promise.all([
        getFailedEmails(db),
        getNeedsReviewEmails(db),
      ]);

      if (showProgress) {
        set({ failedEmails, needsReviewEmails, phase: "complete" });
      } else {
        set({ failedEmails, needsReviewEmails });
      }

      // Refresh home screen transactions
      await useTransactionStore.getState().refresh();
    } catch (err) {
      captureError(err);
    } finally {
      // On error (phase never reached 'complete'), clear immediately.
      // On success, auto-clear after 2s so Connected Accounts can show the transition.
      const currentPhase = get().phase;
      if (currentPhase !== "complete") {
        set({ isFetching: false, progress: null, phase: null });
      } else {
        set({ isFetching: false });
        autoClearTimer = setTimeout(() => {
          autoClearTimer = null;
          if (get().phase === "complete") {
            set({ phase: null, progress: null });
          }
        }, 2000);
      }
    }
  },

  confirmReview: async (processedEmailId, categoryId) => {
    const db = dbRef;
    const userId = userIdRef;
    if (!db || !userId) return;

    const processedEmail = get().needsReviewEmails.find((e) => e.id === processedEmailId);
    if (!processedEmail?.transactionId) return;
    if (!isValidCategoryId(categoryId)) return;

    const now = toIsoDateTime(new Date());

    // Update the transaction's categoryId
    await db
      .update(transactions)
      .set({ categoryId, updatedAt: now })
      .where(eq(transactions.id, processedEmail.transactionId));

    // Enqueue sync for the updated transaction
    enqueueSync(db, {
      id: generateSyncQueueId(),
      tableName: "transactions",
      rowId: processedEmail.transactionId,
      operation: "update",
      createdAt: now,
    });

    // Cache merchant rule so future transactions from this merchant auto-categorize
    const txRows = await db
      .select({ description: transactions.description })
      .from(transactions)
      .where(eq(transactions.id, processedEmail.transactionId));
    const description = txRows[0]?.description;
    if (description) {
      const merchantKey = normalizeMerchant(description);
      await insertMerchantRule(db, userId, merchantKey, categoryId, now);
    }

    // Update the processed email status to "success"
    await updateProcessedEmailStatus(
      db,
      processedEmail.id,
      "success",
      processedEmail.transactionId
    );

    // Remove from needsReviewEmails state and refresh home screen
    set((state) => ({
      needsReviewEmails: state.needsReviewEmails.filter((e) => e.id !== processedEmailId),
    }));
    await useTransactionStore.getState().refresh();
  },
}));
