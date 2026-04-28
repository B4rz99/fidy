import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertMerchantRule } from "@/features/email-capture/lib/merchant-rules";
import {
  deleteEmailAccount,
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmails,
  getNeedsReviewEmails,
  insertEmailAccount,
  updateLastFetchedAt,
  updateProcessedEmailStatus,
} from "@/features/email-capture/lib/repository";
import { getAdapter } from "@/features/email-capture/services/email-adapter";
import { processEmails } from "@/features/email-capture/services/email-pipeline";
import {
  confirmReviewedEmail,
  connectEmailAccount,
  disconnectEmailAccount,
  dismissFailedEmail,
  fetchAndProcessEmails,
  initializeEmailCaptureSession,
  loadEmailAccounts,
  loadFailedEmails,
  loadNeedsReviewEmails,
  useEmailCaptureStore,
} from "@/features/email-capture/store";
import type {
  EmailAccountId,
  IsoDateTime,
  ProcessedEmailId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const { mockCaptureWarning } = vi.hoisted(() => ({
  mockCaptureWarning: vi.fn(),
}));

vi.mock("@/shared/lib", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib")>("@/shared/lib");
  return {
    ...actual,
    captureWarning: mockCaptureWarning,
  };
});

vi.mock("@/features/email-capture/lib/repository", () => ({
  getEmailAccounts: vi.fn().mockResolvedValue([]),
  insertEmailAccount: vi.fn(),
  deleteEmailAccount: vi.fn(),
  getFailedEmails: vi.fn().mockResolvedValue([]),
  getNeedsReviewEmails: vi.fn().mockResolvedValue([]),
  dismissProcessedEmail: vi.fn(),
  updateLastFetchedAt: vi.fn(),
  updateProcessedEmailStatus: vi.fn(),
}));

const mockAdapter = {
  isConnected: vi.fn().mockResolvedValue(true),
  connect: vi.fn(),
  disconnect: vi.fn().mockResolvedValue(undefined),
  fetchEmails: vi.fn().mockResolvedValue([]),
};
vi.mock("@/features/email-capture/services/email-adapter", () => ({
  getAdapter: vi.fn(() => mockAdapter),
}));

vi.mock("@/features/email-capture/services/email-pipeline", () => ({
  processEmails: vi.fn().mockResolvedValue({
    filtered: 0,
    skippedDuplicate: 0,
    skippedCrossSource: 0,
    saved: 0,
    failed: 0,
    needsReview: 0,
  }),
  processRetries: vi.fn().mockResolvedValue({
    retried: 0,
    succeeded: 0,
    permanentlyFailed: 0,
  }),
}));

vi.mock("@/features/email-capture/lib/merchant-rules", () => ({
  insertMerchantRule: vi.fn(),
}));

vi.mock("@/shared/lib/normalize-merchant", () => ({
  normalizeMerchant: vi.fn((s: string) => s.toLowerCase()),
}));

// Mock passes through real implementations for progress-phases
const mockIsFirstFetchForAny = vi.fn((accounts: { lastFetchedAt: string | null }[]) =>
  accounts.some((a) => a.lastFetchedAt === null)
);
const mockShouldShowProgress = vi.fn(
  (emailCount: number, isFirst: boolean, _threshold = 5) => isFirst || emailCount >= _threshold
);
vi.mock("@/features/email-capture/lib/progress-phases", () => ({
  isFirstFetchForAny: (...args: unknown[]) =>
    mockIsFirstFetchForAny(...(args as [{ lastFetchedAt: string | null }[]])),
  shouldShowProgress: (...args: unknown[]) =>
    mockShouldShowProgress(...(args as [number, boolean, number])),
}));

const { mockEnsureBankSenders } = vi.hoisted(() => ({
  mockEnsureBankSenders: vi
    .fn()
    .mockResolvedValue([{ bank: "Bancolombia", email: "notificaciones@bancolombia.com.co" }]),
}));

vi.mock("@/features/email-capture/queries/bank-senders", () => ({
  ensureBankSenders: mockEnsureBankSenders,
}));

vi.mock("@/shared/query", () => ({
  queryClient: { ensureQueryData: vi.fn(), getQueryData: vi.fn() },
}));

const mockRefresh = vi.fn();

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
}));

vi.mock("@/shared/db/schema", () => ({
  transactions: { id: "id", categoryId: "category_id", updatedAt: "updated_at" },
}));

vi.mock("@/shared/lib/generate-id", () => ({
  generateId: vi.fn(() => "ea-generated"),
  generateEmailAccountId: () => "ea-generated",
}));

const mockSelectWhere = vi.fn().mockResolvedValue([{ description: "Compra en Exito" }]);
const mockDb = {
  update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
  select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockSelectWhere }) }),
  // biome-ignore lint/suspicious/noExplicitAny: mock DB object for testing
} as any;
const mockUserId = "user-1";

type TestEmailAccount = {
  id: EmailAccountId;
  userId: UserId;
  provider: string;
  email: string;
  lastFetchedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
};

type RawEmail = {
  externalId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  provider: "gmail" | "outlook";
};

type ProcessSummary = {
  filtered: number;
  skippedDuplicate: number;
  skippedCrossSource: number;
  saved: number;
  failed: number;
  needsReview: number;
};

const DEFAULT_ACCOUNT: TestEmailAccount = {
  id: "ea-1" as EmailAccountId,
  userId: mockUserId as UserId,
  provider: "gmail",
  email: "test@gmail.com",
  lastFetchedAt: null,
  createdAt: "2026-03-05T10:00:00Z" as IsoDateTime,
};

const DEFAULT_RAW_EMAIL: RawEmail = {
  externalId: "ext-1",
  from: "bank@example.com",
  subject: "Alert",
  body: "body",
  receivedAt: "2026-03-05T10:00:00Z",
  provider: "gmail",
};

const EMPTY_PROCESS_SUMMARY: ProcessSummary = {
  filtered: 0,
  skippedDuplicate: 0,
  skippedCrossSource: 0,
  saved: 0,
  failed: 0,
  needsReview: 0,
};

/** Helper to build a typed email account object for tests */
function makeAccount(overrides: Partial<TestEmailAccount> = {}): TestEmailAccount {
  return { ...DEFAULT_ACCOUNT, ...overrides };
}

/** Helper to build a typed processed email object for tests */
function makeProcessedEmail(overrides: Record<string, unknown> = {}) {
  return {
    id: "pe-1" as ProcessedEmailId,
    externalId: "msg-1",
    provider: "gmail",
    status: "failed",
    failureReason: null as string | null,
    subject: "Test",
    rawBodyPreview: null as string | null,
    receivedAt: "2026-03-05T10:00:00Z" as IsoDateTime,
    transactionId: null as TransactionId | null,
    confidence: null as number | null,
    createdAt: "2026-03-05T10:00:00Z" as IsoDateTime,
    rawBody: null as string | null,
    retryCount: 0,
    nextRetryAt: null as IsoDateTime | null,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeRawEmail(overrides: Partial<RawEmail> = {}): RawEmail {
  return { ...DEFAULT_RAW_EMAIL, ...overrides };
}

function setAccounts(accounts: TestEmailAccount[] = [makeAccount()]) {
  useEmailCaptureStore.setState({ accounts });
}

function mockEmptyReviewLoads() {
  vi.mocked(getFailedEmails).mockResolvedValueOnce([]);
  vi.mocked(getNeedsReviewEmails).mockResolvedValueOnce([]);
}

function mockProcessResult(overrides: Partial<ProcessSummary> = {}) {
  vi.mocked(processEmails).mockResolvedValueOnce({ ...EMPTY_PROCESS_SUMMARY, ...overrides });
}

function runFetchAndProcess(gmailClientId = "g", outlookClientId = "o", refresh = mockRefresh) {
  return fetchAndProcessEmails(
    mockDb,
    mockUserId as UserId,
    gmailClientId,
    outlookClientId,
    refresh
  );
}

describe("email capture boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureBankSenders.mockResolvedValue([
      { bank: "Bancolombia", email: "notificaciones@bancolombia.com.co" },
    ]);
    initializeEmailCaptureSession(mockUserId as UserId);
    useEmailCaptureStore.setState({
      accounts: [],
      failedEmails: [],
      needsReviewEmails: [],
      isFetching: false,
      progress: null,
      phase: null,
      bannerDismissed: false,
    });
  });

  it("starts with empty state", () => {
    const state = useEmailCaptureStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.failedEmails).toEqual([]);
    expect(state.needsReviewEmails).toEqual([]);
    expect(state.isFetching).toBe(false);
    expect(state.bannerDismissed).toBe(false);
  });

  it("loadAccounts fetches from DB and sets state", async () => {
    const mockAccounts = [makeAccount()];
    vi.mocked(getEmailAccounts).mockResolvedValueOnce(mockAccounts);

    await loadEmailAccounts(mockDb, mockUserId as UserId);

    expect(getEmailAccounts).toHaveBeenCalledWith(mockDb, mockUserId);
    expect(useEmailCaptureStore.getState().accounts).toEqual(mockAccounts);
  });

  it("drops stale account results after the active user changes", async () => {
    const deferred = createDeferred<ReturnType<typeof makeAccount>[]>();
    vi.mocked(getEmailAccounts).mockReturnValueOnce(deferred.promise);

    const load = loadEmailAccounts(mockDb, mockUserId as UserId);
    initializeEmailCaptureSession("user-2" as UserId);
    deferred.resolve([makeAccount()]);

    await load;

    expect(useEmailCaptureStore.getState()).toMatchObject({
      activeUserId: "user-2",
      accounts: [],
    });
  });

  it("loadFailedEmails fetches from DB and sets state", async () => {
    const mockFailed = [makeProcessedEmail({ failureReason: "parse error", subject: "Compra" })];
    vi.mocked(getFailedEmails).mockResolvedValueOnce(mockFailed);

    await loadFailedEmails(mockDb, mockUserId as UserId);

    expect(getFailedEmails).toHaveBeenCalledWith(mockDb);
    expect(useEmailCaptureStore.getState().failedEmails).toEqual(mockFailed);
    expect(useEmailCaptureStore.getState().failedEmails).toHaveLength(1);
  });

  it("loadNeedsReview fetches from DB and sets state", async () => {
    const mockReview = [
      makeProcessedEmail({
        id: "pe-2" as ProcessedEmailId,
        externalId: "msg-2",
        status: "needs_review",
        subject: "Compra aprobada",
        transactionId: "tx-1" as TransactionId,
        confidence: 0.5,
      }),
    ];
    vi.mocked(getNeedsReviewEmails).mockResolvedValueOnce(mockReview);

    await loadNeedsReviewEmails(mockDb, mockUserId as UserId);

    expect(getNeedsReviewEmails).toHaveBeenCalledWith(mockDb);
    expect(useEmailCaptureStore.getState().needsReviewEmails).toEqual(mockReview);
  });

  it("dismissBanner sets bannerDismissed to true", () => {
    useEmailCaptureStore.getState().dismissBanner();
    expect(useEmailCaptureStore.getState().bannerDismissed).toBe(true);
  });

  it("dismissFailedEmail removes from DB and state", async () => {
    useEmailCaptureStore.setState({
      failedEmails: [makeProcessedEmail()],
    });

    await dismissFailedEmail(mockDb, mockUserId as UserId, "pe-1");

    expect(dismissProcessedEmail).toHaveBeenCalledWith(mockDb, "pe-1");
    expect(useEmailCaptureStore.getState().failedEmails).toHaveLength(0);
  });

  it("connectEmail calls adapter and saves account", async () => {
    mockAdapter.connect.mockResolvedValueOnce({
      success: true,
      email: "user@gmail.com",
    });

    await connectEmailAccount(mockDb, mockUserId as UserId, "gmail", "client-id");

    expect(getAdapter).toHaveBeenCalledWith("gmail");
    expect(mockAdapter.connect).toHaveBeenCalledWith("client-id");
    expect(insertEmailAccount).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        provider: "gmail",
        email: "user@gmail.com",
        userId: mockUserId,
      })
    );
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(1);
  });

  it("connectEmail calls adapter for outlook provider", async () => {
    mockAdapter.connect.mockResolvedValueOnce({
      success: true,
      email: "user@outlook.com",
    });

    await connectEmailAccount(mockDb, mockUserId as UserId, "outlook", "client-id");

    expect(getAdapter).toHaveBeenCalledWith("outlook");
    expect(mockAdapter.connect).toHaveBeenCalledWith("client-id");
    expect(insertEmailAccount).toHaveBeenCalled();
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(1);
  });

  it("connectEmail does not save account on failure", async () => {
    mockAdapter.connect.mockResolvedValueOnce({
      success: false,
      error: "cancelled",
    });

    await connectEmailAccount(mockDb, mockUserId as UserId, "gmail", "client-id");

    expect(insertEmailAccount).not.toHaveBeenCalled();
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(0);
  });

  it("connectEmail rejects duplicate email address", async () => {
    // Pre-existing account with user@gmail.com
    useEmailCaptureStore.setState({
      accounts: [makeAccount({ email: "user@gmail.com" })],
    });

    mockAdapter.connect.mockResolvedValueOnce({
      success: true,
      email: "user@gmail.com",
    });

    await connectEmailAccount(mockDb, mockUserId as UserId, "gmail", "client-id");

    // Should NOT insert a duplicate account
    expect(insertEmailAccount).not.toHaveBeenCalled();
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(1);
  });

  it("disconnectEmail removes from DB and state", async () => {
    useEmailCaptureStore.setState({
      accounts: [makeAccount()],
    });

    await disconnectEmailAccount(mockDb, mockUserId as UserId, "ea-1");

    expect(getAdapter).toHaveBeenCalledWith("gmail");
    expect(mockAdapter.disconnect).toHaveBeenCalled();
    expect(deleteEmailAccount).toHaveBeenCalledWith(mockDb, "ea-1");
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(0);
  });

  it("disconnectEmail still deletes account when provider is unknown", async () => {
    useEmailCaptureStore.setState({
      accounts: [makeAccount({ provider: "legacy-provider" })],
    });

    await disconnectEmailAccount(mockDb, mockUserId as UserId, "ea-1");

    expect(getAdapter).not.toHaveBeenCalled();
    expect(mockAdapter.disconnect).not.toHaveBeenCalled();
    expect(deleteEmailAccount).toHaveBeenCalledWith(mockDb, "ea-1");
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(0);
  });

  describe("fetchAndProcess", () => {
    it("fetches emails and runs pipeline", async () => {
      setAccounts();
      const mockRawEmails = [makeRawEmail()];
      mockAdapter.fetchEmails.mockResolvedValueOnce(mockRawEmails);
      mockProcessResult({ saved: 1 });
      mockEmptyReviewLoads();

      await runFetchAndProcess("gmail-client-id", "outlook-client-id");

      expect(mockEnsureBankSenders).toHaveBeenCalledTimes(1);
      expect(mockAdapter.fetchEmails).toHaveBeenCalled();
      expect(processEmails).toHaveBeenCalled();
      expect(updateLastFetchedAt).toHaveBeenCalled();
      expect(useEmailCaptureStore.getState().isFetching).toBe(false);
    });

    it("fetches emails for outlook accounts", async () => {
      setAccounts([
        makeAccount({
          id: "ea-2" as EmailAccountId,
          provider: "outlook",
          email: "test@outlook.com",
        }),
      ]);

      mockAdapter.fetchEmails.mockResolvedValueOnce([]);
      mockEmptyReviewLoads();

      await runFetchAndProcess("gmail-client-id", "outlook-client-id");

      expect(getAdapter).toHaveBeenCalledWith("outlook");
      expect(mockAdapter.fetchEmails).toHaveBeenCalled();
    });

    it("sets isFetching during execution", async () => {
      setAccounts([makeAccount({ email: "u@g.com", createdAt: "" as IsoDateTime })]);
      mockAdapter.fetchEmails.mockResolvedValueOnce([]);
      mockEmptyReviewLoads();

      const promise = runFetchAndProcess();
      expect(useEmailCaptureStore.getState().isFetching).toBe(true);

      await promise;
      expect(useEmailCaptureStore.getState().isFetching).toBe(false);
    });

    it("warns when the requested email capture session is no longer active", async () => {
      initializeEmailCaptureSession("user-2" as UserId);
      await runFetchAndProcess();

      expect(mockAdapter.fetchEmails).not.toHaveBeenCalled();
      expect(mockCaptureWarning).toHaveBeenCalledWith("email_capture_fetch_missing_context", {
        hasActiveSession: true,
        matchesActiveSession: false,
        activeSessionUserId: "user-2",
      });
    });

    it("skips when already fetching", async () => {
      useEmailCaptureStore.setState({
        isFetching: true,
        accounts: [makeAccount()],
      });

      const result = await runFetchAndProcess();

      expect(mockAdapter.fetchEmails).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "skipped" });
    });

    it("continues processing other accounts when one fails", async () => {
      setAccounts([
        makeAccount(),
        makeAccount({
          id: "ea-2" as EmailAccountId,
          provider: "outlook",
          email: "test@outlook.com",
        }),
      ]);

      mockAdapter.fetchEmails
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce([]);
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(mockAdapter.fetchEmails).toHaveBeenCalledTimes(2);
      expect(useEmailCaptureStore.getState().isFetching).toBe(false);
    });

    it("calls processEmails with correct arguments", async () => {
      setAccounts();
      const mockRawEmails = [makeRawEmail()];
      mockAdapter.fetchEmails.mockResolvedValueOnce(mockRawEmails);
      mockProcessResult({ saved: 1 });
      mockEmptyReviewLoads();

      await runFetchAndProcess("gmail-client-id", "outlook-client-id");

      expect(processEmails).toHaveBeenCalledWith(
        mockDb,
        mockUserId,
        mockRawEmails,
        expect.any(Function)
      );
    });

    it("returns the awaited processing outcome", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([makeRawEmail()]);
      mockProcessResult({ saved: 2, needsReview: 1 });
      mockEmptyReviewLoads();

      const result = await runFetchAndProcess();

      expect(result).toEqual({
        status: "completed",
        savedCount: 2,
        needsReviewCount: 1,
        failedCount: 0,
      });
    });

    it("sets phase to processing when showing progress", async () => {
      setAccounts();
      const mockRawEmails = [makeRawEmail()];
      mockAdapter.fetchEmails.mockResolvedValueOnce(mockRawEmails);

      const phases: (string | null)[] = [];
      vi.mocked(processEmails).mockImplementationOnce(async (_db, _uid, _emails, onProgress) => {
        phases.push(useEmailCaptureStore.getState().phase);
        onProgress?.({ total: 1, completed: 1, saved: 1, failed: 0, needsReview: 0 });
        return {
          filtered: 0,
          skippedDuplicate: 0,
          skippedCrossSource: 0,
          saved: 1,
          failed: 0,
          needsReview: 0,
        };
      });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(phases).toContain("processing");
      expect(useEmailCaptureStore.getState().phase).toBe("complete");
    });

    it("updates in-memory accounts lastFetchedAt after fetch", async () => {
      setAccounts();

      mockAdapter.fetchEmails.mockResolvedValueOnce([]);
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      const updatedAccount = useEmailCaptureStore.getState().accounts[0]!;
      expect(updatedAccount.lastFetchedAt).not.toBeNull();
    });

    it("does not advance lastFetchedAt when fetched emails fail processing", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([makeRawEmail()]);
      mockProcessResult({ failed: 1 });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(updateLastFetchedAt).not.toHaveBeenCalled();
      expect(useEmailCaptureStore.getState().accounts[0]?.lastFetchedAt).toBeNull();
    });

    it("advances lastFetchedAt for accounts whose own emails process successfully", async () => {
      setAccounts([
        makeAccount(),
        makeAccount({
          id: "ea-2" as EmailAccountId,
          provider: "outlook",
          email: "test@outlook.com",
        }),
      ]);
      mockAdapter.fetchEmails
        .mockResolvedValueOnce([makeRawEmail({ externalId: "ext-1" })])
        .mockResolvedValueOnce([makeRawEmail({ externalId: "ext-2", provider: "outlook" })]);
      mockProcessResult({ failed: 1 });
      mockProcessResult({ saved: 1 });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(updateLastFetchedAt).toHaveBeenCalledTimes(1);
      expect(updateLastFetchedAt).toHaveBeenCalledWith(mockDb, "ea-2", expect.any(String));
      const [failedAccount, savedAccount] = useEmailCaptureStore.getState().accounts;
      expect(failedAccount?.lastFetchedAt).toBeNull();
      expect(savedAccount?.lastFetchedAt).not.toBeNull();
    });

    it("auto-clears phase after 2s timeout when phase is complete", async () => {
      vi.useFakeTimers();

      try {
        setAccounts();
        mockAdapter.fetchEmails.mockResolvedValueOnce([
          makeRawEmail({
            from: "b@b.com",
            subject: "A",
            body: "b",
            receivedAt: "2026-03-10T00:00:00Z",
          }),
        ]);
        mockProcessResult({ saved: 1 });
        mockEmptyReviewLoads();

        await runFetchAndProcess();
        expect(useEmailCaptureStore.getState().phase).toBe("complete");
        vi.advanceTimersByTime(2000);
        expect(useEmailCaptureStore.getState().phase).toBeNull();
        expect(useEmailCaptureStore.getState().progress).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("preserves complete phase immediately after fetchAndProcess", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([
        makeRawEmail({
          from: "b@b.com",
          subject: "A",
          body: "b",
          receivedAt: "2026-03-10T00:00:00Z",
        }),
      ]);
      mockProcessResult({ saved: 1 });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(useEmailCaptureStore.getState().phase).toBe("complete");
      expect(useEmailCaptureStore.getState().isFetching).toBe(false);
    });

    it("shows progress on first fetch even with 1 email", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([
        makeRawEmail({
          from: "b@b.com",
          subject: "A",
          body: "b",
          receivedAt: "2026-03-10T00:00:00Z",
        }),
      ]);

      const phases: (string | null)[] = [];
      vi.mocked(processEmails).mockImplementationOnce(async (_db, _uid, _emails, onProgress) => {
        phases.push(useEmailCaptureStore.getState().phase);
        onProgress?.({ total: 1, completed: 1, saved: 0, failed: 0, needsReview: 0 });
        return {
          filtered: 1,
          skippedDuplicate: 0,
          skippedCrossSource: 0,
          saved: 0,
          failed: 0,
          needsReview: 0,
        };
      });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(phases).toContain("processing");
    });

    it("sets complete with zero results when first fetch has 0 emails", async () => {
      setAccounts();

      mockAdapter.fetchEmails.mockResolvedValueOnce([]);
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(useEmailCaptureStore.getState().phase).toBe("complete");
      expect(useEmailCaptureStore.getState().progress).toEqual(
        expect.objectContaining({ total: 0, saved: 0 })
      );
      expect(processEmails).not.toHaveBeenCalled();
    });

    it("clears phase and progress on error in finally block", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([
        makeRawEmail({
          from: "b@b.com",
          subject: "A",
          body: "b",
          receivedAt: "2026-03-10T00:00:00Z",
        }),
      ]);
      vi.mocked(processEmails).mockRejectedValueOnce(new Error("pipeline crash"));

      await runFetchAndProcess();

      expect(useEmailCaptureStore.getState().phase).toBeNull();
      expect(useEmailCaptureStore.getState().progress).toBeNull();
      expect(useEmailCaptureStore.getState().isFetching).toBe(false);
    });

    it("drops stale fetch completions after the active user changes", async () => {
      const deferred = createDeferred<readonly [RawEmail]>();
      setAccounts();
      mockAdapter.fetchEmails.mockReturnValueOnce(deferred.promise);

      const fetch = runFetchAndProcess();
      expect(useEmailCaptureStore.getState().isFetching).toBe(true);

      initializeEmailCaptureSession("user-2" as UserId);
      deferred.resolve([
        makeRawEmail({
          from: "b@b.com",
          subject: "A",
          body: "b",
          receivedAt: "2026-03-10T00:00:00Z",
        }),
      ]);

      await fetch;

      expect(useEmailCaptureStore.getState()).toMatchObject({
        activeUserId: "user-2",
        accounts: [],
        failedEmails: [],
        needsReviewEmails: [],
        isFetching: false,
        phase: null,
        progress: null,
      });
    });
  });

  describe("confirmReview", () => {
    it("updates transaction and removes from needsReviewEmails", async () => {
      useEmailCaptureStore.setState({
        needsReviewEmails: [
          makeProcessedEmail({
            status: "needs_review",
            subject: "Compra aprobada",
            transactionId: "tx-1" as TransactionId,
            confidence: 0.5,
          }),
        ],
      });

      await confirmReviewedEmail(mockDb, mockUserId as UserId, "pe-1", "food", mockRefresh);

      expect(updateProcessedEmailStatus).toHaveBeenCalledWith({
        db: mockDb,
        id: "pe-1",
        status: "success",
        transactionId: "tx-1",
      });
      expect(useEmailCaptureStore.getState().needsReviewEmails).toHaveLength(0);
      // Verify merchant rule was saved
      expect(insertMerchantRule).toHaveBeenCalledWith(
        mockDb,
        mockUserId,
        "compra en exito",
        "food",
        expect.any(String)
      );
      // Verify transactions were reloaded
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("does nothing when processed email not found", async () => {
      useEmailCaptureStore.setState({ needsReviewEmails: [] });

      await confirmReviewedEmail(mockDb, mockUserId as UserId, "nonexistent", "food");

      expect(updateProcessedEmailStatus).not.toHaveBeenCalled();
    });
  });
});
