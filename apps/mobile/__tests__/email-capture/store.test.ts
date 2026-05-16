import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertMerchantRule } from "@/features/email-capture/lib/merchant-rules";
import {
  deleteEmailAccount,
  dismissProcessedEmail,
  getEmailAccounts,
  getFailedEmailSourceEvents,
  getFailedEmails,
  getNeedsReviewEmailSourceEvents,
  getNeedsReviewEmails,
  getProcessedEmailSourceEventIds,
  getProcessedExternalIds,
  insertEmailAccount,
  updateLastFetchedAt,
  updateProcessedEmailStatus,
  updateProcessedSourceEventStatus,
} from "@/features/email-capture/lib/repository";
import { getAdapter } from "@/features/email-capture/services/email-adapter";
import { summarizeFetchedEmailDiagnostics } from "@/features/email-capture/services/email-capture-fetch-service";
import {
  processBackgroundEmails,
  processEmails,
  processInitialSyncEmails,
  processRetries,
} from "@/features/email-capture/services/email-pipeline";
import {
  confirmReviewedEmail,
  connectEmailAccount,
  disconnectEmailAccount,
  dismissFailedEmail,
  dismissFailedEmailSourceEvent,
  fetchAndProcessEmails,
  initializeEmailCaptureSession,
  loadEmailAccounts,
  loadFailedEmails,
  loadNeedsReviewEmails,
  useEmailCaptureStore,
} from "@/features/email-capture/store";
import type * as SharedLib from "@/shared/lib";
import type {
  EmailAccountId,
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const mockShareParseImprovementSample = vi
  .fn<(...args: unknown[]) => Promise<void>>()
  .mockResolvedValue(undefined);

const { mockCaptureWarning } = vi.hoisted(() => ({
  mockCaptureWarning: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
}));

vi.mock("@/shared/lib", async () => {
  const actual = await vi.importActual<typeof SharedLib>("@/shared/lib");
  return {
    ...actual,
    captureWarning: mockCaptureWarning,
  };
});

vi.mock("@/features/email-capture/lib/repository", () => ({
  getEmailAccounts: vi.fn<typeof getEmailAccounts>().mockResolvedValue([]),
  insertEmailAccount: vi.fn<typeof insertEmailAccount>().mockResolvedValue(true),
  deleteEmailAccount: vi.fn<typeof deleteEmailAccount>(),
  getFailedEmails: vi.fn<typeof getFailedEmails>().mockResolvedValue([]),
  getFailedEmailSourceEvents: vi.fn<typeof getFailedEmailSourceEvents>().mockResolvedValue([]),
  getNeedsReviewEmails: vi.fn<typeof getNeedsReviewEmails>().mockResolvedValue([]),
  getNeedsReviewEmailSourceEvents: vi
    .fn<typeof getNeedsReviewEmailSourceEvents>()
    .mockResolvedValue([]),
  getProcessedEmailSourceEventIds: vi
    .fn<typeof getProcessedEmailSourceEventIds>()
    .mockImplementation(
      async (_db, _userId, sourceEvents) =>
        new Set(sourceEvents.map((event) => `${event.sourceId}:${event.sourceEventId}`))
    ),
  getProcessedExternalIds: vi.fn<typeof getProcessedExternalIds>().mockResolvedValue(new Set()),
  dismissProcessedEmail: vi.fn<typeof dismissProcessedEmail>(),
  updateLastFetchedAt: vi.fn<typeof updateLastFetchedAt>(),
  updateProcessedEmailStatus: vi.fn<typeof updateProcessedEmailStatus>(),
  updateProcessedSourceEventStatus: vi.fn<typeof updateProcessedSourceEventStatus>(),
}));

const mockAdapter = {
  isConnected: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  connect:
    vi.fn<() => Promise<{ success: true; email: string } | { success: false; error: string }>>(),
  disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  fetchEmails: vi.fn<() => Promise<RawEmail[]>>().mockResolvedValue([]),
};
vi.mock("@/features/email-capture/services/email-adapter", () => ({
  getAdapter: vi.fn<typeof getAdapter>(() => mockAdapter),
}));

vi.mock("@/features/email-capture/services/email-pipeline", () => ({
  processBackgroundEmails: vi.fn<typeof processBackgroundEmails>().mockResolvedValue({
    filtered: 0,
    skippedDuplicate: 0,
    skippedCrossSource: 0,
    saved: 0,
    failed: 0,
    pendingRetry: 0,
    needsReview: 0,
    parseImprovementRequests: [],
  }),
  processEmails: vi.fn<typeof processEmails>().mockResolvedValue({
    filtered: 0,
    skippedDuplicate: 0,
    skippedCrossSource: 0,
    saved: 0,
    failed: 0,
    pendingRetry: 0,
    needsReview: 0,
    parseImprovementRequests: [],
  }),
  processInitialSyncEmails: vi.fn<typeof processInitialSyncEmails>().mockResolvedValue({
    filtered: 0,
    skippedDuplicate: 0,
    skippedCrossSource: 0,
    saved: 0,
    failed: 0,
    pendingRetry: 0,
    needsReview: 0,
    parseImprovementRequests: [],
  }),
  processRetries: vi.fn<typeof processRetries>().mockResolvedValue({
    retried: 0,
    succeeded: 0,
    permanentlyFailed: 0,
  }),
}));

vi.mock("@/features/capture-sources/diagnostics.public", () => ({
  shareCaptureParseImprovementSample: (...args: unknown[]) =>
    mockShareParseImprovementSample(...args),
}));

vi.mock("@/features/email-capture/lib/merchant-rules", () => ({
  insertMerchantRule: vi.fn<typeof insertMerchantRule>(),
}));

vi.mock("@/shared/lib/normalize-merchant", () => ({
  normalizeMerchant: vi.fn<(s: string) => string>((s: string) => s.toLowerCase()),
}));

// Mock passes through real implementations for progress-phases
const mockIsFirstFetchForAny = vi.fn<(accounts: { lastFetchedAt: string | null }[]) => boolean>(
  (accounts) => accounts.some((a) => a.lastFetchedAt === null)
);
const mockShouldShowProgress = vi.fn<
  (emailCount: number, isFirst: boolean, _threshold?: number) => boolean
>((emailCount, isFirst, _threshold = 5) => isFirst || emailCount >= _threshold);
vi.mock("@/features/email-capture/lib/progress-phases", () => ({
  isFirstFetchForAny: (...args: unknown[]) =>
    mockIsFirstFetchForAny(...(args as [{ lastFetchedAt: string | null }[]])),
  shouldShowProgress: (...args: unknown[]) =>
    mockShouldShowProgress(...(args as [number, boolean, number])),
}));

const { mockEnsureBankSenders } = vi.hoisted(() => ({
  mockEnsureBankSenders: vi
    .fn<() => Promise<{ bank: string; email: string }[]>>()
    .mockResolvedValue([{ bank: "Bancolombia", email: "notificaciones@bancolombia.com.co" }]),
}));

vi.mock("@/features/email-capture/queries/bank-senders", () => ({
  ensureBankSenders: mockEnsureBankSenders,
}));

vi.mock("@/shared/query", () => ({
  queryClient: { ensureQueryData: vi.fn<() => unknown>(), getQueryData: vi.fn<() => unknown>() },
}));

const mockRefresh = vi.fn<() => void>();

vi.mock("drizzle-orm", () => ({
  eq: vi.fn<(...args: unknown[]) => { type: "eq"; args: unknown[] }>((...args: unknown[]) => ({
    type: "eq",
    args,
  })),
}));

vi.mock("@/shared/db/schema", () => ({
  transactions: { id: "id", categoryId: "category_id", updatedAt: "updated_at" },
}));

vi.mock("@/shared/lib/generate-id", () => ({
  generateId: vi.fn<() => string>(() => "ea-generated"),
  generateEmailAccountId: () => "ea-generated",
}));

const mockSelectWhere = vi
  .fn<() => Promise<{ description: string }[]>>()
  .mockResolvedValue([{ description: "Compra en Exito" }]);
const mockDb = {
  update: vi.fn<() => { set: () => { where: () => void } }>().mockReturnValue({
    set: vi.fn<() => { where: () => void }>().mockReturnValue({ where: vi.fn<() => void>() }),
  }),
  select: vi.fn<() => { from: () => { where: typeof mockSelectWhere } }>().mockReturnValue({
    from: vi
      .fn<() => { where: typeof mockSelectWhere }>()
      .mockReturnValue({ where: mockSelectWhere }),
  }),
} as unknown as Parameters<typeof loadEmailAccounts>[0];
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
  sourceId?: string;
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
  pendingRetry: number;
  needsReview: number;
  parseImprovementRequests: readonly {
    readonly rawText: string;
    readonly source: "email_gmail" | "email_outlook";
    readonly status: "failed" | "needs_review";
    readonly confidence: number | null;
    readonly parseMethod: "llm";
  }[];
};

type ProgressSnapshot = {
  total: number;
  completed: number;
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
  pendingRetry: 0,
  needsReview: 0,
  parseImprovementRequests: [],
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

function withFetchedSourceId(email: RawEmail): RawEmail {
  return { ...email, sourceId: "email_gmail:ea-1" };
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

function makeDatedEmails(input: {
  readonly provider: RawEmail["provider"];
  readonly prefix: string;
  readonly hour: string;
  readonly count: number;
}): RawEmail[] {
  return Array.from({ length: input.count }, (_, index) =>
    makeRawEmail({
      externalId: `${input.prefix}-${index + 1}`,
      provider: input.provider,
      receivedAt: `2026-03-05T${input.hour}:${String(index).padStart(2, "0")}:00Z`,
    })
  );
}

function getProcessedInitialSyncExternalIds(): string[] {
  return vi
    .mocked(processInitialSyncEmails)
    .mock.calls.flatMap(([, , emails]) => emails)
    .map((email) => email.externalId);
}

function getProcessedBackgroundExternalIds(): string[] {
  return vi
    .mocked(processBackgroundEmails)
    .mock.calls.flatMap(([, , emails]) => emails)
    .map((email) => email.externalId);
}

function setGmailAndOutlookAccounts() {
  setAccounts([makeAccount(), makeAccount({ id: "ea-2" as EmailAccountId, provider: "outlook" })]);
}

function mockFetchedDatedEmails(input: {
  readonly gmailCount: number;
  readonly outlookCount: number;
}) {
  mockAdapter.fetchEmails
    .mockResolvedValueOnce(
      makeDatedEmails({ provider: "gmail", prefix: "gmail", hour: "10", count: input.gmailCount })
    )
    .mockResolvedValueOnce(
      makeDatedEmails({
        provider: "outlook",
        prefix: "outlook",
        hour: "11",
        count: input.outlookCount,
      })
    );
}

function expectedNewestFirstIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${count - index}`);
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

function runInitialSyncFetch() {
  return fetchAndProcessEmails(
    mockDb,
    mockUserId as UserId,
    "gmail-client-id",
    "outlook-client-id",
    mockRefresh,
    { parseProfile: "initial_sync" }
  );
}

describe("email capture boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(processEmails).mockReset();
    vi.mocked(processBackgroundEmails).mockReset();
    vi.mocked(processInitialSyncEmails).mockReset();
    vi.mocked(processRetries).mockReset();
    vi.mocked(processEmails).mockResolvedValue({ ...EMPTY_PROCESS_SUMMARY });
    vi.mocked(processBackgroundEmails).mockResolvedValue({ ...EMPTY_PROCESS_SUMMARY });
    vi.mocked(processInitialSyncEmails).mockResolvedValue({ ...EMPTY_PROCESS_SUMMARY });
    vi.mocked(processRetries).mockResolvedValue({
      retried: 0,
      succeeded: 0,
      permanentlyFailed: 0,
    });
    vi.mocked(insertEmailAccount).mockResolvedValue(true);
    mockEnsureBankSenders.mockResolvedValue([
      { bank: "Bancolombia", email: "notificaciones@bancolombia.com.co" },
    ]);
    initializeEmailCaptureSession(mockUserId as UserId);
    useEmailCaptureStore.setState({
      accounts: [],
      failedEmails: [],
      failedEmailSourceEvents: [],
      needsReviewEmails: [],
      needsReviewEmailSourceEvents: [],
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

  it("summarizes fetched email diagnostics without sender families or content", () => {
    expect(
      summarizeFetchedEmailDiagnostics([
        {
          account: makeAccount({ provider: "gmail" }) as never,
          fetchOk: true,
          fetchDurationMs: 0,
          rawEmails: [
            makeRawEmail({ from: "notificaciones@rappicard.co" }) as never,
            makeRawEmail({ from: "alertas@rappicard.co" }) as never,
            makeRawEmail({ from: "alertas@davibank.com" }) as never,
          ],
        },
      ])
    ).toEqual({
      totalEmails: 3,
      accounts: [
        {
          provider: "gmail",
          fetchOk: true,
          emailCount: 3,
        },
      ],
    });
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

  it("dismissFailedEmailSourceEvent removes source-event failures from DB and state", async () => {
    useEmailCaptureStore.setState({
      failedEmailSourceEvents: [
        {
          id: "pse-1" as ProcessedSourceEventId,
          userId: mockUserId as UserId,
          sourceFamily: "email",
          sourceId: "email_gmail",
          sourceEventId: "msg-1",
          status: "failed",
          failureReason: "parse_error",
          subject: "Compra",
          rawBodyPreview: "Body",
          rawBody: null,
          retryCount: 0,
          nextRetryAt: null,
          transactionId: null,
          confidence: null,
          receivedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
          processedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
          createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
          updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
          deletedAt: null,
        },
      ],
    });

    await dismissFailedEmailSourceEvent(mockDb, mockUserId as UserId, "pse-1");

    expect(updateProcessedSourceEventStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockDb,
        id: "pse-1",
        status: "dismissed",
        transactionId: null,
      })
    );
    expect(useEmailCaptureStore.getState().failedEmailSourceEvents).toHaveLength(0);
  });

  it("connectEmail calls adapter and saves normalized account", async () => {
    mockAdapter.connect.mockResolvedValueOnce({
      success: true,
      email: "User@Gmail.com",
    });

    const result = await connectEmailAccount(mockDb, mockUserId as UserId, "gmail", "client-id");

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
    expect(result).toEqual({ connected: true });
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

    const result = await connectEmailAccount(mockDb, mockUserId as UserId, "gmail", "client-id");

    expect(insertEmailAccount).not.toHaveBeenCalled();
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(0);
    expect(result).toEqual({ connected: false, reason: "cancelled" });
    expect(mockCaptureWarning).toHaveBeenCalledWith("email_account_connect_failed", {
      provider: "gmail",
      reason: "cancelled",
    });
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

    const result = await connectEmailAccount(mockDb, mockUserId as UserId, "gmail", "client-id");

    // Should NOT insert a duplicate account
    expect(insertEmailAccount).not.toHaveBeenCalled();
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(1);
    expect(result).toEqual({ connected: false, reason: "duplicate_account" });
  });

  it("connectEmail does not append when the database rejects a duplicate account", async () => {
    vi.mocked(insertEmailAccount).mockResolvedValueOnce(false);
    mockAdapter.connect.mockResolvedValueOnce({
      success: true,
      email: "user@gmail.com",
    });

    const result = await connectEmailAccount(mockDb, mockUserId as UserId, "gmail", "client-id");

    expect(insertEmailAccount).toHaveBeenCalled();
    expect(useEmailCaptureStore.getState().accounts).toHaveLength(0);
    expect(result).toEqual({ connected: false, reason: "database_rejected" });
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
      expect(result).toEqual({ status: "skipped", reason: "already_fetching" });
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
        mockRawEmails.map(withFetchedSourceId),
        expect.any(Function)
      );
    });

    it("shares email parse-improvement requests when enabled", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([makeRawEmail()]);
      mockEmptyReviewLoads();
      mockProcessResult({
        needsReview: 1,
        parseImprovementRequests: [
          {
            rawText: "Compra aprobada\n\nSu compra por $50.000 fue aprobada",
            source: "email_gmail",
            status: "needs_review",
            confidence: 0.5,
            parseMethod: "llm",
          },
        ],
      });

      await fetchAndProcessEmails(
        mockDb,
        mockUserId as UserId,
        "gmail-client",
        "outlook-client",
        mockRefresh,
        {
          shareParseImprovementSamples: true,
        }
      );

      expect(mockShareParseImprovementSample).toHaveBeenCalledWith({
        rawText: "Compra aprobada\n\nSu compra por $50.000 fue aprobada",
        source: "email_gmail",
        status: "needs_review",
        confidence: 0.5,
        parseMethod: "llm",
        userId: mockUserId,
        consent: true,
      });
    });

    it("does not share email parse-improvement requests when disabled", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([makeRawEmail()]);
      mockEmptyReviewLoads();
      mockProcessResult({
        failed: 1,
        parseImprovementRequests: [
          {
            rawText: "Compra aprobada\n\nSu compra por $50.000 fue aprobada",
            source: "email_gmail",
            status: "failed",
            confidence: null,
            parseMethod: "llm",
          },
        ],
      });

      await runFetchAndProcess();

      expect(mockShareParseImprovementSample).not.toHaveBeenCalled();
    });

    it("uses the initial sync parser profile when requested", async () => {
      setAccounts();
      const mockRawEmails = [makeRawEmail()];
      mockAdapter.fetchEmails.mockResolvedValueOnce(mockRawEmails);
      vi.mocked(processInitialSyncEmails).mockResolvedValueOnce({
        ...EMPTY_PROCESS_SUMMARY,
        saved: 1,
      });
      mockEmptyReviewLoads();

      await fetchAndProcessEmails(
        mockDb,
        mockUserId as UserId,
        "gmail-client-id",
        "outlook-client-id",
        mockRefresh,
        { parseProfile: "initial_sync" }
      );

      expect(processInitialSyncEmails).toHaveBeenCalledWith(
        mockDb,
        mockUserId,
        mockRawEmails.map(withFetchedSourceId),
        expect.any(Function)
      );
      expect(processEmails).not.toHaveBeenCalled();
    });

    it("uses the background parser profile without bounding email work", async () => {
      setAccounts();
      const mockRawEmails = Array.from({ length: 12 }, (_, index) =>
        makeRawEmail({
          externalId: `ext-${index + 1}`,
          receivedAt: `2026-03-05T10:${String(index).padStart(2, "0")}:00Z`,
        })
      );
      mockAdapter.fetchEmails.mockResolvedValueOnce(mockRawEmails);
      vi.mocked(processBackgroundEmails).mockResolvedValueOnce({
        ...EMPTY_PROCESS_SUMMARY,
        saved: 12,
      });
      mockEmptyReviewLoads();

      await fetchAndProcessEmails(
        mockDb,
        mockUserId as UserId,
        "gmail-client-id",
        "outlook-client-id",
        mockRefresh,
        { parseProfile: "background" }
      );

      expect(processBackgroundEmails).toHaveBeenCalledWith(
        mockDb,
        mockUserId,
        mockRawEmails.slice().reverse().map(withFetchedSourceId),
        expect.any(Function)
      );
      expect(updateLastFetchedAt).not.toHaveBeenCalled();
      expect(processEmails).not.toHaveBeenCalled();
      expect(processInitialSyncEmails).not.toHaveBeenCalled();
      expect(processRetries).not.toHaveBeenCalled();
    });

    it("processes all background work across all fetched accounts", async () => {
      setGmailAndOutlookAccounts();
      mockFetchedDatedEmails({ gmailCount: 8, outlookCount: 8 });
      vi.mocked(processBackgroundEmails)
        .mockResolvedValueOnce({ ...EMPTY_PROCESS_SUMMARY })
        .mockResolvedValueOnce({ ...EMPTY_PROCESS_SUMMARY });
      mockEmptyReviewLoads();

      await fetchAndProcessEmails(
        mockDb,
        mockUserId as UserId,
        "gmail-client-id",
        "outlook-client-id",
        mockRefresh,
        { parseProfile: "background" }
      );

      expect(getProcessedBackgroundExternalIds()).toEqual([
        ...expectedNewestFirstIds("outlook", 8),
        ...expectedNewestFirstIds("gmail", 8),
      ]);
    });

    it("processes all initial sync candidates without advancing account cursors", async () => {
      setAccounts([
        makeAccount(),
        makeAccount({ id: "ea-2" as EmailAccountId, provider: "outlook" }),
      ]);
      mockAdapter.fetchEmails
        .mockResolvedValueOnce(
          makeDatedEmails({ provider: "gmail", prefix: "gmail", hour: "10", count: 12 })
        )
        .mockResolvedValueOnce(
          makeDatedEmails({ provider: "outlook", prefix: "outlook", hour: "11", count: 12 })
        );
      vi.mocked(processInitialSyncEmails)
        .mockResolvedValueOnce({ ...EMPTY_PROCESS_SUMMARY })
        .mockResolvedValueOnce({ ...EMPTY_PROCESS_SUMMARY });
      mockEmptyReviewLoads();

      await runInitialSyncFetch();

      expect(getProcessedInitialSyncExternalIds()).toEqual([
        "outlook-12",
        "outlook-11",
        "outlook-10",
        "outlook-9",
        "outlook-8",
        "outlook-7",
        "outlook-6",
        "outlook-5",
        "outlook-4",
        "outlook-3",
        "outlook-2",
        "outlook-1",
        "gmail-12",
        "gmail-11",
        "gmail-10",
        "gmail-9",
        "gmail-8",
        "gmail-7",
        "gmail-6",
        "gmail-5",
        "gmail-4",
        "gmail-3",
        "gmail-2",
        "gmail-1",
      ]);
      expect(updateLastFetchedAt).not.toHaveBeenCalled();
    });

    it("continues initial sync after enough transaction results are found", async () => {
      setAccounts([
        makeAccount(),
        makeAccount({ id: "ea-2" as EmailAccountId, provider: "outlook" }),
      ]);
      mockAdapter.fetchEmails
        .mockResolvedValueOnce(
          makeDatedEmails({ provider: "gmail", prefix: "gmail", hour: "11", count: 4 })
        )
        .mockResolvedValueOnce(
          makeDatedEmails({ provider: "outlook", prefix: "outlook", hour: "10", count: 4 })
        );
      vi.mocked(processInitialSyncEmails).mockResolvedValueOnce({
        ...EMPTY_PROCESS_SUMMARY,
        saved: 3,
      });
      mockEmptyReviewLoads();

      const outcome = await runInitialSyncFetch();

      expect(outcome).toEqual({
        status: "completed",
        savedCount: 3,
        needsReviewCount: 0,
        failedCount: 0,
      });
      expect(processInitialSyncEmails).toHaveBeenCalledTimes(2);
      expect(getProcessedInitialSyncExternalIds()).toEqual([
        "gmail-4",
        "gmail-3",
        "gmail-2",
        "gmail-1",
        "outlook-4",
        "outlook-3",
        "outlook-2",
        "outlook-1",
      ]);
      expect(updateLastFetchedAt).not.toHaveBeenCalled();
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
          pendingRetry: 0,
          needsReview: 0,
          parseImprovementRequests: [],
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

    it("advances lastFetchedAt when fetched emails are durably queued for retry", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([makeRawEmail()]);
      mockProcessResult({ failed: 1, pendingRetry: 1 });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(updateLastFetchedAt).toHaveBeenCalledWith(mockDb, "ea-1", expect.any(String));
      expect(useEmailCaptureStore.getState().accounts[0]?.lastFetchedAt).not.toBeNull();
    });

    it("advances lastFetchedAt for each account whose provider fetch and local processing is durable", async () => {
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
      mockProcessResult({ failed: 1, pendingRetry: 1 });
      mockProcessResult({ saved: 1 });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(updateLastFetchedAt).toHaveBeenCalledTimes(2);
      expect(updateLastFetchedAt).toHaveBeenCalledWith(mockDb, "ea-1", expect.any(String));
      expect(updateLastFetchedAt).toHaveBeenCalledWith(mockDb, "ea-2", expect.any(String));
      const [failedAccount, savedAccount] = useEmailCaptureStore.getState().accounts;
      expect(failedAccount?.lastFetchedAt).not.toBeNull();
      expect(savedAccount?.lastFetchedAt).not.toBeNull();
    });

    it("reports whole-sync progress across per-account processing", async () => {
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
      const progressSnapshots: ProgressSnapshot[] = [];
      vi.mocked(processEmails)
        .mockImplementationOnce(async (_db, _uid, _emails, onProgress) => {
          onProgress?.({ total: 1, completed: 1, saved: 1, failed: 0, needsReview: 0 });
          progressSnapshots.push(useEmailCaptureStore.getState().progress!);
          return { ...EMPTY_PROCESS_SUMMARY, saved: 1 };
        })
        .mockImplementationOnce(async (_db, _uid, _emails, onProgress) => {
          onProgress?.({ total: 1, completed: 1, saved: 1, failed: 0, needsReview: 0 });
          progressSnapshots.push(useEmailCaptureStore.getState().progress!);
          return { ...EMPTY_PROCESS_SUMMARY, saved: 1 };
        });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(progressSnapshots).toEqual([
        expect.objectContaining({ total: 2, completed: 1, saved: 1 }),
        expect.objectContaining({ total: 2, completed: 2, saved: 2 }),
      ]);
    });

    it("refreshes transactions as foreground email transactions are found and after completion", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([
        makeRawEmail({ externalId: "ext-1" }),
        makeRawEmail({ externalId: "ext-2" }),
        makeRawEmail({ externalId: "ext-3" }),
      ]);
      vi.mocked(processEmails).mockImplementationOnce(async (_db, _uid, _emails, onProgress) => {
        onProgress?.({ total: 3, completed: 1, saved: 1, failed: 0, needsReview: 0 });
        onProgress?.({ total: 3, completed: 2, saved: 1, failed: 0, needsReview: 1 });
        onProgress?.({ total: 3, completed: 3, saved: 2, failed: 0, needsReview: 1 });
        return { ...EMPTY_PROCESS_SUMMARY, saved: 2, needsReview: 1 };
      });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(mockRefresh).toHaveBeenCalledTimes(4);
    });

    it("drops queued progress refreshes after the active fetch run changes", async () => {
      const refreshGate = createDeferred<void>();
      const processingGate = createDeferred<void>();
      const slowRefresh = vi
        .fn<() => void>()
        .mockImplementationOnce(() => refreshGate.promise as unknown as void);
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([
        makeRawEmail({ externalId: "ext-1" }),
        makeRawEmail({ externalId: "ext-2" }),
      ]);
      vi.mocked(processEmails).mockImplementationOnce(async (_db, _uid, _emails, onProgress) => {
        onProgress?.({ total: 2, completed: 1, saved: 1, failed: 0, needsReview: 0 });
        onProgress?.({ total: 2, completed: 2, saved: 2, failed: 0, needsReview: 0 });
        await processingGate.promise;
        return { ...EMPTY_PROCESS_SUMMARY, saved: 2 };
      });
      mockEmptyReviewLoads();

      const fetchRun = runFetchAndProcess("g", "o", slowRefresh);
      await vi.waitFor(() => expect(slowRefresh).toHaveBeenCalledTimes(1));

      initializeEmailCaptureSession("user-2" as UserId);
      refreshGate.resolve();
      processingGate.resolve();
      await fetchRun;

      expect(slowRefresh).toHaveBeenCalledTimes(1);
    });

    it("does not refresh transactions for filtered foreground email progress", async () => {
      setAccounts();
      mockAdapter.fetchEmails.mockResolvedValueOnce([makeRawEmail({ externalId: "ext-1" })]);
      vi.mocked(processEmails).mockImplementationOnce(async (_db, _uid, _emails, onProgress) => {
        onProgress?.({ total: 1, completed: 1, saved: 0, failed: 0, needsReview: 0 });
        return { ...EMPTY_PROCESS_SUMMARY, filtered: 1 };
      });
      mockEmptyReviewLoads();

      await runFetchAndProcess();

      expect(mockRefresh).toHaveBeenCalledTimes(1);
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
          pendingRetry: 0,
          needsReview: 0,
          parseImprovementRequests: [],
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
      const deferred = createDeferred<RawEmail[]>();
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
