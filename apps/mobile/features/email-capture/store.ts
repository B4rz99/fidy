import { eq } from "drizzle-orm";
import { create } from "zustand";
import { enqueueSync } from "@/features/transactions/lib/repository";
import { useTransactionStore } from "@/features/transactions/store";
import type { AnyDb } from "@/shared/db/client";
import { transactions } from "@/shared/db/schema";
import { generateId } from "@/shared/lib/generate-id";
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
import { type ProgressCallback, processEmails } from "./services/email-pipeline";
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
    if (!dbRef || !userIdRef) {
      console.warn("[EmailCapture] fetchAndProcess: no db or userId");
      return;
    }
    if (get().isFetching) {
      console.warn("[EmailCapture] fetchAndProcess: already fetching, skipping");
      return;
    }

    set({ isFetching: true });

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

      if (allEmails.length > 0) {
        let lastRefreshedSaved = 0;
        await processEmails(dbRef!, userIdRef!, allEmails, (progress) => {
          set({ progress });
          // Refresh transactions on home screen only when new ones are saved
          if (progress.saved > lastRefreshedSaved) {
            lastRefreshedSaved = progress.saved;
            useTransactionStore.getState().loadTransactions();
          }
        });
      }

      // Update lastFetchedAt only for accounts whose fetch succeeded
      const now = new Date().toISOString();
      await Promise.all(
        fetchResults
          .filter((r) => r.fetchOk)
          .map((r) => updateLastFetchedAt(dbRef!, r.account.id, now))
      );

      const [failedEmails, needsReviewEmails] = await Promise.all([
        getFailedEmails(dbRef),
        getNeedsReviewEmails(dbRef),
      ]);
      set({ failedEmails, needsReviewEmails });

      // Refresh home screen transactions
      await useTransactionStore.getState().loadTransactions();
    } catch (err) {
      console.warn("[EmailCapture] fetchAndProcess error:", err);
    } finally {
      set({ isFetching: false, progress: null });
    }
  },

  confirmReview: async (processedEmailId, categoryId) => {
    if (!dbRef || !userIdRef) return;

    const processedEmail = get().needsReviewEmails.find((e) => e.id === processedEmailId);
    if (!processedEmail || !processedEmail.transactionId) return;

    const now = new Date().toISOString();

    // Update the transaction's categoryId
    await dbRef
      .update(transactions)
      .set({ categoryId, updatedAt: now })
      .where(eq(transactions.id, processedEmail.transactionId));

    // Enqueue sync for the updated transaction
    await enqueueSync(dbRef, {
      id: generateId("sq"),
      tableName: "transactions",
      rowId: processedEmail.transactionId,
      operation: "update",
      createdAt: now,
    });

    // Note: merchant rule insertion requires the original sender email address,
    // which is not stored in processed_emails. The pipeline already caches rules
    // for high-confidence results. For confirmed reviews, we skip rule caching
    // since the sender email is unavailable from the processed record.

    // Update the processed email status to "success"
    await updateProcessedEmailStatus(
      dbRef,
      processedEmailId,
      "success",
      processedEmail.transactionId
    );

    // Remove from needsReviewEmails state
    set((state) => ({
      needsReviewEmails: state.needsReviewEmails.filter((e) => e.id !== processedEmailId),
    }));
  },
}));
