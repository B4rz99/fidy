import { eq } from "drizzle-orm";
import { create } from "zustand";
import { enqueueSync } from "@/features/transactions/lib/repository";
import { useTransactionStore } from "@/features/transactions/store";
import type { AnyDb } from "@/shared/db/client";
import { transactions } from "@/shared/db/schema";
import { generateId } from "@/shared/lib/generate-id";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";
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
import type { EmailProvider } from "./schema";
import { fetchBankSenders } from "./services/bank-senders-cache";
import type { ProgressPhase } from "./lib/progress-phases";
import { isFirstFetchForAny, shouldShowProgress } from "./lib/progress-phases";
import { type ProgressCallback, processEmails, processRetries } from "./services/email-pipeline";
import { connectGmail, disconnectGmail, fetchGmailEmails } from "./services/gmail-adapter";
import { connectOutlook, disconnectOutlook, fetchOutlookEmails } from "./services/outlook-adapter";

let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;

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
  clearProgress: () => void;
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

  clearProgress: () => set({ phase: null, progress: null }),

  dismissFailedEmail: async (id) => {
    if (!dbRef) return;
    await dismissProcessedEmail(dbRef, id);
    const updated = get().failedEmails.filter((e) => e.id !== id);
    set({ failedEmails: updated });
  },

  connectEmail: async (provider, clientId) => {
    if (!dbRef || !userIdRef) return;

    const result =
      provider === "gmail" ? await connectGmail(clientId) : await connectOutlook(clientId);

    if (!result.success) return;

    const row: EmailAccountRow = {
      id: generateId("ea"),
      userId: userIdRef,
      provider,
      email: result.email,
      lastFetchedAt: null,
      createdAt: new Date().toISOString(),
    };

    await insertEmailAccount(dbRef, row);
    set((state) => ({ accounts: [...state.accounts, row] }));
  },

  disconnectEmail: async (id) => {
    if (!dbRef) return;
    const account = get().accounts.find((a) => a.id === id);
    if (account) {
      if (account.provider === "gmail") await disconnectGmail();
      else if (account.provider === "outlook") await disconnectOutlook();
    }
    await deleteEmailAccount(dbRef, id);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    }));
  },

  fetchAndProcess: async (gmailClientId, outlookClientId) => {
    const db = dbRef;
    const userId = userIdRef;
    if (!db || !userId) {
      console.warn("[EmailCapture] fetchAndProcess: no db or userId");
      return;
    }
    if (get().isFetching) {
      console.warn("[EmailCapture] fetchAndProcess: already fetching, skipping");
      return;
    }

    // Clear any stale progress state from a previous run (e.g. if clearProgress
    // wasn't called before this sync was triggered by AppState change)
    set({ isFetching: true, phase: null, progress: null });

    try {
      const { accounts } = get();
      if (accounts.length === 0) {
        console.warn("[EmailCapture] no connected accounts");
        return;
      }

      const senders = await fetchBankSenders();
      const senderEmails = senders.map((s) => s.email);

      // Always look back at least 30 days; dedup by externalId prevents re-processing
      const minSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch emails from all accounts in parallel
      const fetchResults = await Promise.all(
        accounts.map(async (account) => {
          try {
            const since =
              account.lastFetchedAt && account.lastFetchedAt < minSince
                ? account.lastFetchedAt
                : minSince;
            const rawEmails =
              account.provider === "gmail"
                ? await fetchGmailEmails(gmailClientId, since, senderEmails)
                : await fetchOutlookEmails(outlookClientId, since, senderEmails);
            return { account, rawEmails, fetchOk: true };
          } catch (err) {
            console.warn(`[EmailCapture] ${account.provider} fetch error:`, err);
            return { account, rawEmails: [] as import("./schema").RawEmail[], fetchOk: false };
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
        set({ phase: "fetching" });
        set({ phase: "processing" });

        let lastRefreshedSaved = 0;
        await processEmails(db, userId, allEmails, (progress) => {
          set({ progress });
          if (progress.saved > lastRefreshedSaved) {
            lastRefreshedSaved = progress.saved;
            useTransactionStore.getState().refresh();
          }
        });
      } else if (allEmails.length > 0) {
        // Silent processing — no progress UI
        let lastRefreshedSaved = 0;
        await processEmails(db, userId, allEmails, (progress) => {
          set({ progress });
          if (progress.saved > lastRefreshedSaved) {
            lastRefreshedSaved = progress.saved;
            useTransactionStore.getState().refresh();
          }
        });
      }

      await processRetries(db, userId);

      // Update lastFetchedAt only for accounts whose fetch succeeded
      const now = new Date().toISOString();
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
      console.warn("[EmailCapture] fetchAndProcess error:", err);
    } finally {
      // If phase is 'complete', let the component handle cleanup via clearProgress.
      // Only force-clear on error (phase never reached 'complete').
      const currentPhase = get().phase;
      if (currentPhase !== "complete") {
        set({ isFetching: false, progress: null, phase: null });
      } else {
        set({ isFetching: false });
      }
    }
  },

  confirmReview: async (processedEmailId, categoryId) => {
    const db = dbRef;
    const userId = userIdRef;
    if (!db || !userId) return;

    const processedEmail = get().needsReviewEmails.find((e) => e.id === processedEmailId);
    if (!processedEmail || !processedEmail.transactionId) return;

    const now = new Date().toISOString();

    // Update the transaction's categoryId
    await db
      .update(transactions)
      .set({ categoryId, updatedAt: now })
      .where(eq(transactions.id, processedEmail.transactionId));

    // Enqueue sync for the updated transaction
    await enqueueSync(db, {
      id: generateId("sq"),
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
    await updateProcessedEmailStatus(db, processedEmailId, "success", processedEmail.transactionId);

    // Remove from needsReviewEmails state and refresh home screen
    set((state) => ({
      needsReviewEmails: state.needsReviewEmails.filter((e) => e.id !== processedEmailId),
    }));
    await useTransactionStore.getState().refresh();
  },
}));
