import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import type { EmailAccountRow } from "@/features/email-capture/lib/repository";
import type { ProcessedSourceEventRow } from "@/features/email-capture/lib/source-event-repository";
import {
  applyEmailCaptureFetchOutcome,
  createEmailCaptureStoreState,
  isManagedEmailProvider,
  resolveEmailAccountId,
  useEmailCaptureStore,
  warnFetchMissingContext,
} from "@/features/email-capture/store/state";
import {
  applyEmailCaptureFetchSummary,
  beginEmailCaptureFetchRun,
  beginEmailCaptureRequest,
  createEmailCaptureFetchProgressHandler,
  createEmailCaptureSession,
  finalizeEmailCaptureFetchRun,
  initializeEmailCaptureStoreSession,
  isActiveEmailCaptureSession,
  isCurrentEmailCaptureFetchRun,
  isCurrentEmailCaptureRequest,
  registerEmailCaptureStoreRuntime,
} from "@/features/email-capture/services/email-capture-store-runtime";
import { requireUserId } from "@/shared/types/assertions";
import type {
  EmailAccountId,
  IsoDateTime,
  ProcessedSourceEventId,
  UserId,
} from "@/shared/types/branded";

vi.mock("@/shared/lib", () => ({
  captureWarning: vi.fn<(...args: unknown[]) => unknown>(),
}));

const { captureWarning } = await import("@/shared/lib");

const USER_ID = requireUserId("user-1");
const OTHER_USER_ID = requireUserId("user-2");
const NOW = "2026-04-23T10:00:00.000Z" as IsoDateTime;

function makeAccount(overrides: Partial<EmailAccountRow> = {}): EmailAccountRow {
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

function sourceEvent(id: string): ProcessedSourceEventRow {
  return {
    id: id as ProcessedSourceEventId,
    userId: USER_ID,
    sourceFamily: "email",
    sourceId: "email_gmail",
    sourceEventId: `${id}-event`,
    status: "failed",
    failureReason: null,
    subject: "Purchase alert",
    rawBodyPreview: "Preview",
    rawBody: null,
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

const runtimeState = () => useEmailCaptureStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  runtimeState().beginSession(USER_ID);
  registerEmailCaptureStoreRuntime({
    beginSession: (userId) => runtimeState().beginSession(userId),
    getActiveUserId: () => runtimeState().activeUserId,
    getIsFetching: () => runtimeState().isFetching,
    getPhase: () => runtimeState().phase,
    setIsFetching: (isFetching) => runtimeState().setIsFetching(isFetching),
    setPhase: (phase) => runtimeState().setPhase(phase),
    setProgress: (progress) => runtimeState().setProgress(progress),
  });
  initializeEmailCaptureStoreSession(USER_ID);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("email capture store state helper", () => {
  it("begins a new session and clears transient store state", () => {
    const store = create(createEmailCaptureStoreState);

    store.setState({
      activeUserId: "user-0" as UserId,
      accounts: [makeAccount()],
      failedEmailSourceEvents: [{ id: "failed-1" }] as never[],
      needsReviewEmailSourceEvents: [{ id: "review-1" }] as never[],
      isFetching: true,
      progress: { total: 2, completed: 1, saved: 1, failed: 0, needsReview: 0 },
      phase: "processing",
      bannerDismissed: true,
    });

    store.getState().beginSession(USER_ID);

    expect(store.getState()).toMatchObject({
      activeUserId: USER_ID,
      accounts: [],
      failedEmailSourceEvents: [],
      needsReviewEmailSourceEvents: [],
      isFetching: false,
      progress: null,
      phase: null,
      bannerDismissed: false,
    });
  });

  it("updates fetched accounts without mutating unrelated entries", () => {
    const store = create(createEmailCaptureStoreState);
    const accountOne = makeAccount();
    const accountTwo = makeAccount({
      id: "ea-2" as EmailAccountId,
      email: "other@gmail.com",
      lastFetchedAt: "2026-04-22T09:00:00.000Z" as IsoDateTime,
    });
    const fetchedAt = "2026-04-23T12:00:00.000Z" as IsoDateTime;

    store.getState().setAccounts([accountOne, accountTwo]);
    store.getState().markAccountsFetched(new Set([accountOne.id]), fetchedAt);

    expect(store.getState().accounts).toEqual([
      { ...accountOne, lastFetchedAt: fetchedAt },
      accountTwo,
    ]);
  });

  it("applies queue and fetch outcome only for the active run", async () => {
    const refreshTransactions = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const account = makeAccount();
    runtimeState().setAccounts([account]);
    const start = beginEmailCaptureFetchRun(USER_ID);
    expect(start.kind).toBe("ready");
    if (start.kind !== "ready") return;

    await applyEmailCaptureFetchOutcome({
      run: start.run,
      showProgress: true,
      persistedAccounts: {
        updatedAccountIds: new Set([account.id]),
        fetchedAt: NOW,
      },
      queues: {
        failedEmailSourceEvents: [sourceEvent("failed-1")],
        needsReviewEmailSourceEvents: [sourceEvent("review-1")],
      },
      refreshTransactions,
    });

    expect(runtimeState().accounts[0]?.lastFetchedAt).toBe(NOW);
    expect(runtimeState().failedEmailSourceEvents.map((event) => event.id)).toEqual(["failed-1"]);
    expect(runtimeState().needsReviewEmailSourceEvents.map((event) => event.id)).toEqual([
      "review-1",
    ]);
    expect(runtimeState().phase).toBe("complete");
    expect(refreshTransactions).toHaveBeenCalledTimes(1);

    initializeEmailCaptureStoreSession(OTHER_USER_ID);
    await applyEmailCaptureFetchOutcome({
      run: start.run,
      showProgress: true,
      persistedAccounts: {
        updatedAccountIds: new Set([account.id]),
        fetchedAt: NOW,
      },
      queues: {
        failedEmailSourceEvents: [],
        needsReviewEmailSourceEvents: [],
      },
      refreshTransactions,
    });
    expect(refreshTransactions).toHaveBeenCalledTimes(1);
  });

  it("resolves email account ids and warns when fetch context is missing", () => {
    const account = makeAccount();

    expect(resolveEmailAccountId(account, "unused")).toBe(account.id);
    expect(resolveEmailAccountId(undefined, "email-account-2")).toBe("email-account-2");
    expect(isManagedEmailProvider("gmail")).toBe(true);
    expect(isManagedEmailProvider("outlook")).toBe(true);
    expect(isManagedEmailProvider("imap")).toBe(false);

    warnFetchMissingContext(OTHER_USER_ID);
    expect(captureWarning).toHaveBeenCalledWith("email_capture_fetch_missing_context", {
      hasActiveSession: true,
      matchesActiveSession: false,
      activeSessionUserId: USER_ID,
    });
  });
});

describe("email capture store runtime", () => {
  it("rejects fetch runs before a matching session and while already fetching", () => {
    initializeEmailCaptureStoreSession(USER_ID);

    expect(beginEmailCaptureFetchRun(OTHER_USER_ID)).toEqual({ kind: "missing_context" });
    const first = beginEmailCaptureFetchRun(USER_ID);
    expect(first.kind).toBe("ready");
    expect(beginEmailCaptureFetchRun(USER_ID)).toEqual({ kind: "already_fetching" });
  });

  it("tracks current request ids across sessions", () => {
    const request = beginEmailCaptureRequest("failedEmails", USER_ID);
    const session = createEmailCaptureSession(USER_ID);

    expect(isActiveEmailCaptureSession(session)).toBe(true);
    expect(isCurrentEmailCaptureRequest(request)).toBe(true);

    beginEmailCaptureRequest("failedEmails", USER_ID);
    expect(isCurrentEmailCaptureRequest(request)).toBe(false);

    initializeEmailCaptureStoreSession(OTHER_USER_ID);
    expect(isActiveEmailCaptureSession(session)).toBe(false);
  });

  it("summarizes fetch progress and refreshes when found count increases", async () => {
    const refreshTransactions = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const start = beginEmailCaptureFetchRun(USER_ID);
    expect(start.kind).toBe("ready");
    if (start.kind !== "ready") return;

    applyEmailCaptureFetchSummary({
      run: start.run,
      showProgress: false,
      emailCount: 0,
    });
    expect(runtimeState().phase).toBeNull();

    applyEmailCaptureFetchSummary({
      run: start.run,
      showProgress: true,
      emailCount: 3,
    });
    expect(runtimeState().phase).toBe("processing");

    const onProgress = createEmailCaptureFetchProgressHandler(start.run, refreshTransactions);
    onProgress({ total: 3, completed: 1, saved: 1, failed: 0, needsReview: 0 });
    onProgress({ total: 3, completed: 2, saved: 1, failed: 0, needsReview: 1 });
    onProgress({ total: 3, completed: 3, saved: 1, failed: 1, needsReview: 1 });
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(runtimeState().progress).toEqual({
      total: 3,
      completed: 3,
      saved: 1,
      failed: 1,
      needsReview: 1,
    });
    expect(refreshTransactions).toHaveBeenCalledTimes(2);
  });

  it("finalizes active fetch runs and clears completed progress after the delay", async () => {
    const emptyStart = beginEmailCaptureFetchRun(USER_ID);
    expect(emptyStart.kind).toBe("ready");
    if (emptyStart.kind !== "ready") return;

    applyEmailCaptureFetchSummary({
      run: emptyStart.run,
      showProgress: true,
      emailCount: 0,
    });
    finalizeEmailCaptureFetchRun(emptyStart.run);

    expect(runtimeState().isFetching).toBe(false);
    expect(runtimeState().phase).toBe("complete");
    expect(runtimeState().progress).toEqual({
      total: 0,
      completed: 0,
      saved: 0,
      failed: 0,
      needsReview: 0,
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(runtimeState().phase).toBeNull();
    expect(runtimeState().progress).toBeNull();
  });

  it("clears non-complete fetch state immediately and ignores stale runs", () => {
    const start = beginEmailCaptureFetchRun(USER_ID);
    expect(start.kind).toBe("ready");
    if (start.kind !== "ready") return;

    applyEmailCaptureFetchSummary({
      run: start.run,
      showProgress: true,
      emailCount: 2,
    });
    finalizeEmailCaptureFetchRun(start.run);

    expect(runtimeState().isFetching).toBe(false);
    expect(runtimeState().phase).toBeNull();
    expect(runtimeState().progress).toBeNull();

    initializeEmailCaptureStoreSession(OTHER_USER_ID);
    expect(isCurrentEmailCaptureFetchRun(start.run)).toBe(false);
    finalizeEmailCaptureFetchRun(start.run);
    expect(runtimeState().isFetching).toBe(false);
  });
});
