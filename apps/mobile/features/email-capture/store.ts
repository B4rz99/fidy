import { create } from "zustand";
import type { AnyDb } from "@/shared/db/client";
import type { EmailAccountRow, ProcessedEmailRow } from "./lib/repository";
import {
  deleteEmailAccount,
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmails,
} from "./lib/repository";

let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;

type EmailCaptureState = {
  accounts: EmailAccountRow[];
  failedEmails: ProcessedEmailRow[];
  failedCount: number;
  isFetching: boolean;
  bannerDismissed: boolean;
};

type EmailCaptureActions = {
  initStore: (db: AnyDb, userId: string) => void;
  loadAccounts: () => Promise<void>;
  loadFailedEmails: () => Promise<void>;
  dismissBanner: () => void;
  dismissFailedEmail: (id: string) => Promise<void>;
  connectEmail: () => void;
  disconnectEmail: (id: string) => Promise<void>;
};

export const useEmailCaptureStore = create<EmailCaptureState & EmailCaptureActions>((set, get) => ({
  accounts: [],
  failedEmails: [],
  failedCount: 0,
  isFetching: false,
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
    set({ failedEmails, failedCount: failedEmails.length });
  },

  dismissBanner: () => set({ bannerDismissed: true }),

  dismissFailedEmail: async (id) => {
    if (!dbRef) return;
    await dismissProcessedEmail(dbRef, id);
    const updated = get().failedEmails.filter((e) => e.id !== id);
    set({ failedEmails: updated, failedCount: updated.length });
  },

  connectEmail: () => {
    // Stub — will be implemented when OAuth flow is added
  },

  disconnectEmail: async (id) => {
    if (!dbRef) return;
    await deleteEmailAccount(dbRef, id);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    }));
  },
}));
