import { create, type StateCreator } from "zustand";
import { captureWarning } from "@/shared/lib";
import { assertEmailAccountId } from "@/shared/types/assertions";
import type { EmailAccountId, IsoDateTime, UserId } from "@/shared/types/branded";
import type { ProgressPhase } from "../lib/progress-phases";
import type { EmailAccountRow, ProcessedSourceEventRow } from "../lib/repository";
import type { ProgressCallback } from "../pipeline.public";
import type { EmailProvider } from "../schema";
import type { PersistedFetchedAccounts } from "../services/email-capture-fetch-service";
import type { EmailCaptureQueues } from "../services/email-capture-queues";
import {
  type EmailCaptureFetchRun,
  isCurrentEmailCaptureFetchRun,
} from "../services/email-capture-store-runtime";

export type ProgressSnapshot = Parameters<ProgressCallback>[0];
export type RefreshTransactions = () => Promise<void> | void;

export type EmailCaptureState = {
  readonly activeUserId: UserId | null;
  readonly accounts: readonly EmailAccountRow[];
  readonly failedEmailSourceEvents: readonly ProcessedSourceEventRow[];
  readonly needsReviewEmailSourceEvents: readonly ProcessedSourceEventRow[];
  readonly isFetching: boolean;
  readonly progress: ProgressSnapshot | null;
  readonly phase: ProgressPhase | null;
  readonly bannerDismissed: boolean;
};

export type EmailCaptureActions = {
  beginSession: (userId: UserId) => void;
  setAccounts: (accounts: readonly EmailAccountRow[]) => void;
  setFailedEmailSourceEvents: (failedEmailSourceEvents: readonly ProcessedSourceEventRow[]) => void;
  setNeedsReviewEmailSourceEvents: (
    needsReviewEmailSourceEvents: readonly ProcessedSourceEventRow[]
  ) => void;
  setIsFetching: (isFetching: boolean) => void;
  setProgress: (progress: ProgressSnapshot | null) => void;
  setPhase: (phase: ProgressPhase | null) => void;
  dismissBanner: () => void;
  appendAccount: (account: EmailAccountRow) => void;
  removeAccount: (accountId: string) => void;
  removeFailedEmail: (processedSourceEventId: string) => void;
  removeNeedsReviewEmail: (processedSourceEventId: string) => void;
  markAccountsFetched: (accountIds: ReadonlySet<EmailAccountId>, fetchedAt: IsoDateTime) => void;
};

export type EmailCaptureStore = EmailCaptureState & EmailCaptureActions;
type EmailCaptureSetState = Parameters<StateCreator<EmailCaptureStore>>[0];

export function createEmailCaptureState(activeUserId: UserId | null): EmailCaptureState {
  return {
    activeUserId,
    accounts: [],
    failedEmailSourceEvents: [],
    needsReviewEmailSourceEvents: [],
    isFetching: false,
    progress: null,
    phase: null,
    bannerDismissed: false,
  };
}

function beginEmailCaptureSession(set: EmailCaptureSetState): EmailCaptureActions["beginSession"] {
  return (userId) => set(createEmailCaptureState(userId));
}

export function createEmailCaptureActions(set: EmailCaptureSetState): EmailCaptureActions {
  return {
    beginSession: beginEmailCaptureSession(set),
    setAccounts: (accounts) => set({ accounts: [...accounts] }),
    setFailedEmailSourceEvents: (failedEmailSourceEvents) =>
      set({ failedEmailSourceEvents: [...failedEmailSourceEvents] }),
    setNeedsReviewEmailSourceEvents: (needsReviewEmailSourceEvents) =>
      set({ needsReviewEmailSourceEvents: [...needsReviewEmailSourceEvents] }),
    setIsFetching: (isFetching) => set({ isFetching }),
    setProgress: (progress) => set({ progress }),
    setPhase: (phase) => set({ phase }),
    dismissBanner: () => set({ bannerDismissed: true }),
    appendAccount: (account) =>
      set((state) => ({
        accounts: [...state.accounts, account],
      })),
    removeAccount: (accountId) =>
      set((state) => ({
        accounts: state.accounts.filter((account) => account.id !== accountId),
      })),
    removeFailedEmail: (processedSourceEventId) =>
      set((state) => ({
        failedEmailSourceEvents: state.failedEmailSourceEvents.filter(
          (email) => email.id !== processedSourceEventId
        ),
      })),
    removeNeedsReviewEmail: (processedSourceEventId) =>
      set((state) => ({
        needsReviewEmailSourceEvents: state.needsReviewEmailSourceEvents.filter(
          (email) => email.id !== processedSourceEventId
        ),
      })),
    markAccountsFetched: (accountIds, fetchedAt) =>
      set((state) => ({
        accounts: state.accounts.map((account) =>
          accountIds.has(account.id) ? { ...account, lastFetchedAt: fetchedAt } : account
        ),
      })),
  };
}

export const createEmailCaptureStoreState: StateCreator<EmailCaptureStore> = (set) => ({
  ...createEmailCaptureState(null),
  ...createEmailCaptureActions(set),
});

export const useEmailCaptureStore = create(createEmailCaptureStoreState);

export function resolveEmailAccountId(
  account: EmailAccountRow | undefined,
  emailAccountId: string
): EmailAccountId {
  if (account) return account.id;
  assertEmailAccountId(emailAccountId);
  return emailAccountId;
}

export function isManagedEmailProvider(provider: string | undefined): provider is EmailProvider {
  return provider === "gmail" || provider === "outlook";
}

export function warnFetchMissingContext(userId: UserId): void {
  const activeUserId = useEmailCaptureStore.getState().activeUserId;

  captureWarning("email_capture_fetch_missing_context", {
    hasActiveSession: activeUserId !== null,
    matchesActiveSession: activeUserId === userId,
    activeSessionUserId: activeUserId ?? "none",
  });
}

export async function applyEmailCaptureFetchOutcome(input: {
  readonly run: EmailCaptureFetchRun;
  readonly showProgress: boolean;
  readonly persistedAccounts: PersistedFetchedAccounts;
  readonly queues: EmailCaptureQueues;
  readonly refreshTransactions: RefreshTransactions;
}): Promise<void> {
  if (!isCurrentEmailCaptureFetchRun(input.run)) return;

  const state = useEmailCaptureStore.getState();
  state.markAccountsFetched(
    input.persistedAccounts.updatedAccountIds,
    input.persistedAccounts.fetchedAt
  );
  state.setFailedEmailSourceEvents(input.queues.failedEmailSourceEvents);
  state.setNeedsReviewEmailSourceEvents(input.queues.needsReviewEmailSourceEvents);
  if (input.showProgress) state.setPhase("complete");
  await input.refreshTransactions();
}
