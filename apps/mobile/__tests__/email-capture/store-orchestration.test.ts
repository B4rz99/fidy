// biome-ignore-all lint/suspicious/noExplicitAny: store orchestration test uses module mocks
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EmailAccountRow,
  ProcessedSourceEventRow,
} from "@/features/email-capture/lib/repository";
import type {
  EmailAccountId,
  IsoDateTime,
  ProcessedSourceEventId,
  UserId,
} from "@/shared/types/branded";

const mocks = vi.hoisted(() => ({
  captureError: vi.fn<(...args: any[]) => any>(),
  captureWarning: vi.fn<(...args: any[]) => any>(),
  getEmailAccounts: vi.fn<(...args: any[]) => any>(),
  getFailedEmailSourceEvents: vi.fn<(...args: any[]) => any>(),
  getNeedsReviewEmailSourceEvents: vi.fn<(...args: any[]) => any>(),
  updateProcessedSourceEventStatus: vi.fn<(...args: any[]) => any>(),
  fetchEmailAccountBatch: vi.fn<(...args: any[]) => any>(),
  ingestFetchedEmails: vi.fn<(...args: any[]) => any>(),
  persistFetchedAccounts: vi.fn<(...args: any[]) => any>(),
  loadEmailCaptureQueues: vi.fn<(...args: any[]) => any>(),
  shareEmailParseImprovementRequests: vi.fn<(...args: any[]) => any>(),
  insertEmailAccount: vi.fn<(...args: any[]) => any>(),
  deleteEmailAccount: vi.fn<(...args: any[]) => any>(),
  getAdapter: vi.fn<(...args: any[]) => any>(),
  generateEmailAccountId: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/shared/lib", () => ({
  captureError: (...args: any[]) => mocks.captureError(...args),
  captureWarning: (...args: any[]) => mocks.captureWarning(...args),
  generateEmailAccountId: (...args: any[]) => mocks.generateEmailAccountId(...args),
  toIsoDateTime: (date: Date) => date.toISOString(),
}));

vi.mock("@/features/email-capture/lib/repository", () => ({
  getEmailAccounts: (...args: any[]) => mocks.getEmailAccounts(...args),
  getFailedEmailSourceEvents: (...args: any[]) => mocks.getFailedEmailSourceEvents(...args),
  getNeedsReviewEmailSourceEvents: (...args: any[]) =>
    mocks.getNeedsReviewEmailSourceEvents(...args),
  updateProcessedSourceEventStatus: (...args: any[]) =>
    mocks.updateProcessedSourceEventStatus(...args),
  insertEmailAccount: (...args: any[]) => mocks.insertEmailAccount(...args),
  deleteEmailAccount: (...args: any[]) => mocks.deleteEmailAccount(...args),
}));

vi.mock("@/features/email-capture/services/email-capture-fetch-service", () => ({
  applyEmailCaptureCandidateLimit: (results: readonly any[], limit: number | null) =>
    limit == null ? results : results.slice(0, limit),
  createEmailFetchClientIds: (gmailClientId: string, outlookClientId: string) => ({
    gmailClientId,
    outlookClientId,
  }),
  fetchEmailAccountBatch: (...args: any[]) => mocks.fetchEmailAccountBatch(...args),
  ingestFetchedEmails: (...args: any[]) => mocks.ingestFetchedEmails(...args),
  persistFetchedAccounts: (...args: any[]) => mocks.persistFetchedAccounts(...args),
  resolveEmailCaptureSyncPolicy: () => ({
    advancesLastFetchedAt: true,
    maxCandidateEmails: null,
    parseProfile: "default",
    runRetries: true,
    showsProgress: true,
  }),
  sortFetchResultsByNewestEmail: (results: readonly any[]) => [...results],
}));

vi.mock("@/features/email-capture/services/email-capture-queues", () => ({
  loadEmailCaptureQueues: (...args: any[]) => mocks.loadEmailCaptureQueues(...args),
}));

vi.mock("@/features/email-capture/services/email-parse-improvement-sharing", () => ({
  shareEmailParseImprovementRequests: (...args: any[]) =>
    mocks.shareEmailParseImprovementRequests(...args),
}));

vi.mock("@/features/email-capture/services/email-adapter", () => ({
  getAdapter: (...args: any[]) => mocks.getAdapter(...args),
}));

const USER_ID = "user-1" as UserId;
const OTHER_USER_ID = "user-2" as UserId;
const NOW = "2026-04-23T10:00:00.000Z" as IsoDateTime;
const db = {} as any;

function account(overrides: Partial<EmailAccountRow> = {}): EmailAccountRow {
  return {
    id: "ea-1" as EmailAccountId,
    userId: USER_ID,
    provider: "gmail",
    email: "person@gmail.com",
    lastFetchedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function sourceEvent(
  id: string,
  status: ProcessedSourceEventRow["status"]
): ProcessedSourceEventRow {
  return {
    id: id as ProcessedSourceEventId,
    userId: USER_ID,
    sourceFamily: "email",
    sourceId: "email_gmail",
    sourceEventId: `${id}-event`,
    status,
    failureReason: null,
    retryCount: 0,
    nextRetryAt: null,
    transactionId: null,
    confidence: null,
    receivedAt: NOW,
    processedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

async function loadStoreModule() {
  return import("@/features/email-capture/store");
}

describe("email capture store orchestration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date(NOW));
    mocks.generateEmailAccountId.mockReturnValue("ea-new");
    mocks.loadEmailCaptureQueues.mockResolvedValue({
      failedEmailSourceEvents: [],
      needsReviewEmailSourceEvents: [],
    });
    mocks.shareEmailParseImprovementRequests.mockResolvedValue(undefined);
    mocks.persistFetchedAccounts.mockResolvedValue({
      fetchedAt: NOW,
      updatedAccountIds: new Set(["ea-1"]),
    });
    const store = await loadStoreModule();
    store.useEmailCaptureStore.getState().beginSession(USER_ID);
    store.initializeEmailCaptureSession(USER_ID);
  });

  it("loads accounts and ignores stale account responses", async () => {
    const store = await loadStoreModule();
    const firstAccount = account({ email: "first@gmail.com" });
    const staleAccount = account({ id: "ea-stale" as EmailAccountId, email: "stale@gmail.com" });
    let resolveFirst: (rows: EmailAccountRow[]) => void = () => undefined;
    mocks.getEmailAccounts
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce([firstAccount]);

    const firstLoad = store.loadEmailAccounts(db, USER_ID);
    const secondLoad = store.loadEmailAccounts(db, USER_ID);
    resolveFirst([staleAccount]);
    await firstLoad;
    await secondLoad;

    expect(store.useEmailCaptureStore.getState().accounts).toEqual([firstAccount]);
  });

  it("loads failed and needs-review source-event queues with warning fallback", async () => {
    const store = await loadStoreModule();
    const failedEvent = sourceEvent("failed-1", "failed");
    const reviewEvent = sourceEvent("review-1", "needs_review");
    mocks.getFailedEmailSourceEvents.mockResolvedValueOnce([failedEvent]);
    mocks.getNeedsReviewEmailSourceEvents.mockResolvedValueOnce([reviewEvent]);

    await store.loadFailedEmails(db, USER_ID);
    await store.loadNeedsReviewEmails(db, USER_ID);

    expect(store.useEmailCaptureStore.getState().failedEmailSourceEvents).toEqual([failedEvent]);
    expect(store.useEmailCaptureStore.getState().needsReviewEmailSourceEvents).toEqual([
      reviewEvent,
    ]);

    mocks.getFailedEmailSourceEvents.mockRejectedValueOnce(new Error("boom"));
    mocks.getNeedsReviewEmailSourceEvents.mockRejectedValueOnce("nope");
    await store.loadFailedEmails(db, USER_ID);
    await store.loadNeedsReviewEmails(db, USER_ID);

    expect(store.useEmailCaptureStore.getState().failedEmailSourceEvents).toEqual([]);
    expect(store.useEmailCaptureStore.getState().needsReviewEmailSourceEvents).toEqual([]);
    expect(mocks.captureWarning).toHaveBeenCalledWith("email_capture_failed_queue_load_failed", {
      errorType: "Error",
    });
    expect(mocks.captureWarning).toHaveBeenCalledWith(
      "email_capture_needs_review_queue_load_failed",
      { errorType: "unknown" }
    );
  });

  it("dismisses active failed source events and ignores stale sessions", async () => {
    const store = await loadStoreModule();
    store.useEmailCaptureStore
      .getState()
      .setFailedEmailSourceEvents([sourceEvent("failed-1", "failed")]);
    mocks.updateProcessedSourceEventStatus.mockResolvedValue(undefined);

    await store.dismissFailedEmailSourceEvent(db, USER_ID, "failed-1");

    expect(mocks.updateProcessedSourceEventStatus).toHaveBeenCalledWith({
      db,
      id: "failed-1",
      status: "dismissed",
      transactionId: null,
    });
    expect(store.useEmailCaptureStore.getState().failedEmailSourceEvents).toEqual([]);

    store.useEmailCaptureStore
      .getState()
      .setFailedEmailSourceEvents([sourceEvent("failed-2", "failed")]);
    store.initializeEmailCaptureSession(OTHER_USER_ID);
    await store.dismissFailedEmailSourceEvent(db, USER_ID, "failed-2");
    expect(mocks.updateProcessedSourceEventStatus).toHaveBeenCalledTimes(1);
  });

  it("handles fetch skips, empty accounts, successful processing, and failures", async () => {
    const store = await loadStoreModule();
    store.useEmailCaptureStore.getState().beginSession(null as never);

    await expect(
      store.fetchAndProcessEmails(db, USER_ID, "gmail-client", "outlook-client")
    ).resolves.toEqual({ status: "skipped", reason: "missing_context" });
    expect(mocks.captureWarning).toHaveBeenCalledWith(
      "email_capture_fetch_missing_context",
      expect.objectContaining({ hasActiveSession: false })
    );

    store.initializeEmailCaptureSession(USER_ID);
    await expect(
      store.fetchAndProcessEmails(db, USER_ID, "gmail-client", "outlook-client")
    ).resolves.toEqual({ status: "completed", savedCount: 0, needsReviewCount: 0, failedCount: 0 });
    expect(mocks.captureWarning).toHaveBeenCalledWith("email_capture_fetch_no_accounts");

    store.useEmailCaptureStore.getState().setAccounts([account()]);
    mocks.fetchEmailAccountBatch.mockResolvedValueOnce({
      showProgress: true,
      fetchResults: [
        {
          account: account(),
          fetchOk: true,
          rawEmails: [{ id: "email-1", receivedAt: NOW }],
        },
      ],
    });
    mocks.ingestFetchedEmails.mockResolvedValueOnce({
      saved: 1,
      needsReview: 1,
      failed: 0,
      parseImprovementRequests: [{ source: "email_gmail" }],
    });
    const refreshTransactions = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      store.fetchAndProcessEmails(
        db,
        USER_ID,
        "gmail-client",
        "outlook-client",
        refreshTransactions,
        {
          shareParseImprovementSamples: true,
        }
      )
    ).resolves.toEqual({ status: "completed", savedCount: 1, needsReviewCount: 1, failedCount: 0 });

    expect(mocks.ingestFetchedEmails).toHaveBeenCalledWith(
      expect.objectContaining({ runRetries: false })
    );
    expect(mocks.ingestFetchedEmails).toHaveBeenCalledWith(
      expect.objectContaining({ emails: [], parseProfile: "default" })
    );
    expect(mocks.shareEmailParseImprovementRequests).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    );
    expect(refreshTransactions).toHaveBeenCalled();

    mocks.fetchEmailAccountBatch.mockRejectedValueOnce(new Error("fetch failed"));
    await expect(
      store.fetchAndProcessEmails(db, USER_ID, "gmail-client", "outlook-client")
    ).resolves.toEqual({ status: "completed", savedCount: 0, needsReviewCount: 0, failedCount: 0 });
    expect(mocks.captureError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("counts skipped emails when reporting per-account fetch progress", async () => {
    const store = await loadStoreModule();
    const progressCalls: Array<{
      readonly total: number;
      readonly completed: number;
      readonly saved: number;
      readonly failed: number;
      readonly needsReview: number;
    }> = [];
    store.useEmailCaptureStore
      .getState()
      .setAccounts([
        account({ id: "ea-1" as EmailAccountId }),
        account({ id: "ea-2" as EmailAccountId, email: "second@gmail.com" }),
      ]);
    mocks.fetchEmailAccountBatch.mockResolvedValueOnce({
      showProgress: true,
      fetchResults: [
        {
          account: account({ id: "ea-1" as EmailAccountId }),
          fetchOk: true,
          rawEmails: [{ id: "email-1", receivedAt: NOW }],
        },
        {
          account: account({ id: "ea-2" as EmailAccountId, email: "second@gmail.com" }),
          fetchOk: true,
          rawEmails: [
            { id: "email-2", receivedAt: NOW },
            { id: "email-3", receivedAt: NOW },
          ],
        },
      ],
    });
    mocks.ingestFetchedEmails
      .mockImplementationOnce(async (input) => {
        input.onProgress?.({ total: 1, completed: 1, saved: 1, failed: 0, needsReview: 0 });
        return { saved: 1, needsReview: 0, failed: 0, parseImprovementRequests: [] };
      })
      .mockImplementationOnce(async (input) => {
        input.onProgress?.({ total: 0, completed: 0, saved: 0, failed: 0, needsReview: 0 });
        return { saved: 0, needsReview: 0, failed: 0, parseImprovementRequests: [] };
      });
    store.useEmailCaptureStore.subscribe((state) => {
      if (state.progress) progressCalls.push(state.progress);
    });

    await store.fetchAndProcessEmails(db, USER_ID, "gmail-client", "outlook-client");

    expect(progressCalls).toContainEqual({
      total: 3,
      completed: 3,
      saved: 1,
      failed: 0,
      needsReview: 0,
    });
  });

  it("persists account cursors when queue refresh fails after processing", async () => {
    const store = await loadStoreModule();
    store.useEmailCaptureStore.getState().setAccounts([account()]);
    mocks.fetchEmailAccountBatch.mockResolvedValueOnce({
      showProgress: true,
      fetchResults: [
        {
          account: account(),
          fetchOk: true,
          rawEmails: [{ id: "email-1", receivedAt: NOW }],
        },
      ],
    });
    mocks.ingestFetchedEmails.mockResolvedValueOnce({
      saved: 0,
      needsReview: 1,
      failed: 0,
      parseImprovementRequests: [],
    });
    mocks.loadEmailCaptureQueues.mockRejectedValueOnce(new Error("queue failed"));

    await expect(
      store.fetchAndProcessEmails(db, USER_ID, "gmail-client", "outlook-client")
    ).resolves.toEqual({ status: "completed", savedCount: 0, needsReviewCount: 1, failedCount: 0 });

    expect(mocks.captureWarning).toHaveBeenCalledWith("email_capture_queue_refresh_failed", {
      errorType: "Error",
    });
    expect(mocks.persistFetchedAccounts).toHaveBeenCalled();
  });

  it("connects managed email accounts and reports account connection failures", async () => {
    const store = await loadStoreModule();
    const adapter = {
      connect: vi.fn<(...args: any[]) => any>(),
      disconnect: vi.fn<(...args: any[]) => any>(),
    };
    mocks.getAdapter.mockReturnValue(adapter);
    mocks.insertEmailAccount.mockResolvedValue(true);

    adapter.connect.mockResolvedValueOnce({ success: false, error: "cancelled" });
    await expect(store.connectEmailAccount(db, USER_ID, "gmail", "client-id")).resolves.toEqual({
      connected: false,
      reason: "cancelled",
    });

    adapter.connect.mockResolvedValueOnce({ success: false, error: "bad_callback" });
    await expect(store.connectEmailAccount(db, USER_ID, "gmail", "client-id")).resolves.toEqual({
      connected: false,
      reason: "unknown",
    });

    store.useEmailCaptureStore.getState().setAccounts([account()]);
    adapter.connect.mockResolvedValueOnce({ success: true, email: "PERSON@gmail.com" });
    await expect(store.connectEmailAccount(db, USER_ID, "gmail", "client-id")).resolves.toEqual({
      connected: false,
      reason: "duplicate_account",
    });

    store.useEmailCaptureStore.getState().setAccounts([]);
    mocks.insertEmailAccount.mockResolvedValueOnce(false);
    adapter.connect.mockResolvedValueOnce({ success: true, email: "new@gmail.com" });
    await expect(store.connectEmailAccount(db, USER_ID, "gmail", "client-id")).resolves.toEqual({
      connected: false,
      reason: "database_rejected",
    });

    mocks.insertEmailAccount.mockResolvedValueOnce(true);
    adapter.connect.mockResolvedValueOnce({ success: true, email: "NEW@gmail.com" });
    await expect(store.connectEmailAccount(db, USER_ID, "gmail", "client-id")).resolves.toEqual({
      connected: true,
    });

    expect(store.useEmailCaptureStore.getState().accounts).toEqual([
      expect.objectContaining({
        id: "ea-new",
        provider: "gmail",
        email: "new@gmail.com",
      }),
    ]);
    expect(mocks.captureWarning).toHaveBeenCalledWith("email_account_connect_failed", {
      provider: "gmail",
      reason: "cancelled",
    });
  });

  it("rejects account connection when context goes stale", async () => {
    const store = await loadStoreModule();
    const adapter = {
      connect: vi.fn<(...args: any[]) => any>(async () => {
        store.initializeEmailCaptureSession(OTHER_USER_ID);
        return { success: true, email: "stale@gmail.com" };
      }),
      disconnect: vi.fn<(...args: any[]) => any>(),
    };
    mocks.getAdapter.mockReturnValue(adapter);

    await expect(store.connectEmailAccount(db, USER_ID, "gmail", "client-id")).resolves.toEqual({
      connected: false,
      reason: "stale_session",
    });
    expect(mocks.insertEmailAccount).not.toHaveBeenCalled();
  });

  it("disconnects managed and unmanaged accounts only while the session is active", async () => {
    const store = await loadStoreModule();
    const adapter = {
      connect: vi.fn<(...args: any[]) => any>(),
      disconnect: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
    };
    mocks.getAdapter.mockReturnValue(adapter);
    mocks.deleteEmailAccount.mockResolvedValue(undefined);
    const gmailAccount = account();
    const customAccount = account({
      id: "ea-custom" as EmailAccountId,
      provider: "custom" as never,
      email: "custom@example.com",
    });
    store.useEmailCaptureStore.getState().setAccounts([gmailAccount, customAccount]);

    await store.disconnectEmailAccount(db, USER_ID, gmailAccount.id);
    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.deleteEmailAccount).toHaveBeenCalledWith(db, gmailAccount.id);
    expect(store.useEmailCaptureStore.getState().accounts).toEqual([customAccount]);

    await store.disconnectEmailAccount(db, USER_ID, customAccount.id);
    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.deleteEmailAccount).toHaveBeenCalledWith(db, customAccount.id);
    expect(store.useEmailCaptureStore.getState().accounts).toEqual([]);

    store.initializeEmailCaptureSession(OTHER_USER_ID);
    await store.disconnectEmailAccount(db, USER_ID, "missing-account");
    expect(mocks.deleteEmailAccount).toHaveBeenCalledTimes(2);
  });
});
