// biome-ignore-all lint/suspicious/noExplicitAny: mock db/supabase need flexible typing
// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase API column names
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCursor,
  createLocalAccountSuggestionDismissal,
  createLocalCaptureEvidence,
  createLocalFinancialAccount,
  createLocalFinancialAccountIdentifier,
  createLocalOpeningBalance,
  createLocalTransaction,
  createLocalTransfer,
  createSequentialServerTransactions,
  createServerAccountSuggestionDismissalRow,
  createServerCaptureEvidenceRow,
  createServerFinancialAccountIdentifierRow,
  createServerFinancialAccountRow,
  createServerOpeningBalanceRow,
  createServerTransactionRow,
  createServerTransferRow,
  createSyncQueueEntry,
  SYNC_USER_ID,
} from "./fixtures";

const mockGetQueuedSyncEntries = vi.fn().mockReturnValue([]);
const mockClearSyncEntries = vi.fn();
const mockGetAccountSuggestionDismissalById = vi.fn().mockReturnValue(null);
const mockGetTransactionById = vi.fn().mockReturnValue(null);
const mockGetFinancialAccountById = vi.fn().mockReturnValue(null);
const mockGetFinancialAccountIdentifierById = vi.fn().mockReturnValue(null);
const mockGetOpeningBalanceById = vi.fn().mockReturnValue(null);
const mockGetOpeningBalanceForAccount = vi.fn().mockReturnValue(null);
const mockGetTransferById = vi.fn().mockReturnValue(null);
const mockGetCaptureEvidenceById = vi.fn().mockReturnValue(null);
const mockEnsureDefaultFinancialAccount = vi
  .fn()
  .mockImplementation((_: unknown, userId: string) => ({ id: `fa-default-${userId}` }));
const mockGetSyncMeta = vi.fn().mockReturnValue(null);
const mockSetSyncMeta = vi.fn();
const mockUpsertTransaction = vi.fn();
const mockInsertTransaction = vi.fn();
const mockUpsertAccountSuggestionDismissal = vi.fn();
const mockUpsertFinancialAccount = vi.fn();
const mockUpsertFinancialAccountIdentifier = vi.fn();
const mockUpsertOpeningBalance = vi.fn();
const mockUpsertTransfer = vi.fn();
const mockUpsertCaptureEvidence = vi.fn();

const mockInsertConflict = vi.fn();
vi.mock("@/features/sync/lib/conflict-repository", () => ({
  insertConflict: (...args: any[]) => mockInsertConflict(...args),
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  getQueuedSyncEntries: (...args: any[]) => mockGetQueuedSyncEntries(...args),
  clearSyncEntries: (...args: any[]) => mockClearSyncEntries(...args),
  getTransactionById: (...args: any[]) => mockGetTransactionById(...args),
  getSyncMeta: (...args: any[]) => mockGetSyncMeta(...args),
  setSyncMeta: (...args: any[]) => mockSetSyncMeta(...args),
  insertTransaction: (...args: any[]) => mockInsertTransaction(...args),
  upsertTransaction: (...args: any[]) => mockUpsertTransaction(...args),
}));

vi.mock("@/features/account-suggestions/lib/dismissals-repository", () => ({
  getAccountSuggestionDismissalById: (...args: any[]) =>
    mockGetAccountSuggestionDismissalById(...args),
  upsertAccountSuggestionDismissal: (...args: any[]) =>
    mockUpsertAccountSuggestionDismissal(...args),
}));

vi.mock("@/features/financial-accounts/lib/default-account", () => ({
  buildDefaultFinancialAccountId: (userId: string) => `fa-default-${userId}`,
}));

vi.mock("@/features/financial-accounts/lib/repository", () => ({
  ensureDefaultFinancialAccount: (...args: any[]) => mockEnsureDefaultFinancialAccount(...args),
  getFinancialAccountById: (...args: any[]) => mockGetFinancialAccountById(...args),
  upsertFinancialAccount: (...args: any[]) => mockUpsertFinancialAccount(...args),
}));

vi.mock("@/features/financial-accounts/lib/identifiers-repository", () => ({
  getFinancialAccountIdentifierById: (...args: any[]) =>
    mockGetFinancialAccountIdentifierById(...args),
  upsertFinancialAccountIdentifier: (...args: any[]) =>
    mockUpsertFinancialAccountIdentifier(...args),
}));

vi.mock("@/features/financial-accounts/lib/opening-balances-repository", () => ({
  getOpeningBalanceById: (...args: any[]) => mockGetOpeningBalanceById(...args),
  getOpeningBalanceForAccount: (...args: any[]) => mockGetOpeningBalanceForAccount(...args),
  upsertOpeningBalance: (...args: any[]) => mockUpsertOpeningBalance(...args),
}));

vi.mock("@/features/transfers/lib/repository", () => ({
  getTransferById: (...args: any[]) => mockGetTransferById(...args),
  upsertTransfer: (...args: any[]) => mockUpsertTransfer(...args),
}));

vi.mock("@/features/capture-evidence/lib/repository", () => ({
  getCaptureEvidenceById: (...args: any[]) => mockGetCaptureEvidenceById(...args),
  upsertCaptureEvidence: (...args: any[]) => mockUpsertCaptureEvidence(...args),
}));

const mockDb = {} as any;
const mockUpsert = vi.fn().mockReturnValue({ error: null });

type QueryResult = { data: any; error: any };

function isQueryResult(value: QueryResult | Record<string, QueryResult>): value is QueryResult {
  return "data" in value && "error" in value;
}

function createQueryChain(queryResult: QueryResult) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(queryResult),
  };
  chain.select.mockReturnValue(chain);
  return chain;
}

function createMockSupabase(
  queryResults: QueryResult | Record<string, QueryResult> = { data: [], error: null }
) {
  const chains = new Map<string, ReturnType<typeof createQueryChain>>();
  const getQueryResult = (tableName: string): QueryResult =>
    isQueryResult(queryResults)
      ? queryResults
      : (queryResults[tableName] ?? { data: [], error: null });
  const getChain = (tableName: string) => {
    const existing = chains.get(tableName);
    if (existing) return existing;
    const chain = createQueryChain(getQueryResult(tableName));
    chains.set(tableName, chain);
    return chain;
  };
  return {
    from: vi.fn((tableName: string) => ({
      upsert: mockUpsert,
      select: getChain(tableName).select,
    })),
    _getChain: getChain,
  } as any;
}

function getLastSetSyncMetaValue(key: string) {
  const calls = mockSetSyncMeta.mock.calls.filter(([, candidateKey]) => candidateKey === key);
  const lastCall = calls.at(-1);
  return typeof lastCall?.[2] === "string" ? lastCall[2] : null;
}

function createTransactionPullSupabase(overrides: Record<string, unknown> = {}) {
  return createMockSupabase({
    data: [createServerTransactionRow(overrides)],
    error: null,
  });
}

function createFinancialTablesSupabase() {
  return createMockSupabase({
    transactions: { data: [], error: null },
    capture_evidence: { data: [createServerCaptureEvidenceRow()], error: null },
    financial_accounts: { data: [createServerFinancialAccountRow()], error: null },
    transfers: { data: [createServerTransferRow()], error: null },
    opening_balances: { data: [createServerOpeningBalanceRow()], error: null },
    financial_account_identifiers: {
      data: [createServerFinancialAccountIdentifierRow()],
      error: null,
    },
  });
}

function createDismissalPullSupabase() {
  return createMockSupabase({
    account_suggestion_dismissals: {
      data: [createServerAccountSuggestionDismissalRow()],
      error: null,
    },
    capture_evidence: { data: [], error: null },
    financial_accounts: { data: [], error: null },
    transfers: { data: [], error: null },
    opening_balances: { data: [], error: null },
    financial_account_identifiers: { data: [], error: null },
    transactions: { data: [], error: null },
  });
}

function createSecondaryFailureSupabase() {
  return createMockSupabase({
    transactions: {
      data: [
        createServerTransactionRow({
          id: "tx-remote-1",
          type: "income",
          amount: 5000,
          category_id: "salary",
          description: "Pay",
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T12:00:00.000Z",
        }),
      ],
      error: null,
    },
    financial_accounts: {
      data: null,
      error: { message: "accounts unavailable", code: "500" },
    },
    transfers: { data: [], error: null },
    opening_balances: { data: [], error: null },
    financial_account_identifiers: { data: [], error: null },
  });
}

function createSameTimestampTransactionSupabase() {
  return createMockSupabase({
    transactions: {
      data: [
        createServerTransactionRow({
          id: "tx-1001",
          amount: 1000,
          description: null,
          created_at: "2026-04-18T12:00:00.000Z",
          updated_at: "2026-04-18T12:00:00.000Z",
        }),
        createServerTransactionRow({
          id: "tx-1002",
          amount: 1000,
          description: null,
          created_at: "2026-04-18T12:00:00.000Z",
          updated_at: "2026-04-18T12:00:00.000Z",
        }),
      ],
      error: null,
    },
  });
}

function createCompositeSyncMeta(updatedAt: string, id: string) {
  const syncMeta = new Map<string, string>([
    ["last_sync_at_transactions", JSON.stringify(createCursor(updatedAt, id))],
  ]);
  mockGetSyncMeta.mockImplementation((_, key: string) => syncMeta.get(key) ?? null);
  mockSetSyncMeta.mockImplementation((_, key: string, value: string) => {
    syncMeta.set(key, value);
  });
  return syncMeta;
}

async function runSyncPush(mockSupabase: any, userId = SYNC_USER_ID) {
  const { syncPush } = await import("@/features/sync/services/syncEngine");
  await syncPush(mockDb, mockSupabase, userId);
}

async function runSyncPull(mockSupabase: any, userId = SYNC_USER_ID) {
  const { syncPull } = await import("@/features/sync/services/syncEngine");
  return syncPull(mockDb, mockSupabase, userId);
}

function expectQueueCleared(...entryIds: string[]) {
  expect(mockClearSyncEntries).toHaveBeenCalledWith(mockDb, entryIds);
}

function expectCursorToEqual(key: string, cursor: Record<string, string>) {
  expect(JSON.parse(getLastSetSyncMetaValue(key)!)).toEqual(cursor);
}

function expectUpsertedTransaction(matcher: Record<string, unknown>) {
  expect(mockUpsertTransaction).toHaveBeenCalledWith(mockDb, expect.objectContaining(matcher));
}

function expectLastSyncAt(value: string) {
  expect(mockSetSyncMeta).toHaveBeenCalledWith(mockDb, "last_sync_at", value);
}

function expectConflictLogged(transactionId: string) {
  expect(mockInsertConflict).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({ transactionId })
  );
}

function expectCaptureEvidencePulled() {
  expect(mockUpsertCaptureEvidence).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      id: "ce-1",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-1",
    })
  );
}

function expectFinancialAccountPulled() {
  expect(mockUpsertFinancialAccount).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      id: "fa-1",
      userId: "user-1",
      isDefault: true,
    })
  );
}

function expectTransferPulled() {
  expect(mockUpsertTransfer).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      id: "tr-1",
      fromAccountId: "fa-1",
      toAccountId: "fa-2",
    })
  );
}

function createBusyTableCursorSupabase() {
  return createMockSupabase({
    transactions: { data: createSequentialServerTransactions(1000), error: null },
    financial_accounts: {
      data: [
        createServerFinancialAccountRow({
          created_at: "2026-04-19T00:00:00.000Z",
          updated_at: "2026-04-19T00:00:00.000Z",
        }),
      ],
      error: null,
    },
  });
}

function expectBusyTableCursorIsolation() {
  expectCursorToEqual(
    "last_sync_at_transactions",
    createCursor("2026-04-18T0999:00:00.000Z", "tx-1000")
  );
  expect(mockSetSyncMeta).toHaveBeenCalledWith(
    mockDb,
    "last_sync_at",
    "2026-04-18T0999:00:00.000Z"
  );
  expectCursorToEqual(
    "last_sync_at_financial_accounts",
    createCursor("2026-04-19T00:00:00.000Z", "fa-1")
  );
  expect(getLastSetSyncMetaValue("last_sync_at_transactions")).not.toContain(
    "2026-04-19T00:00:00.000Z"
  );
}

function expectOpeningBalancePulled() {
  expect(mockUpsertOpeningBalance).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      id: "ob-1",
      accountId: "fa-1",
      amount: 500000,
    })
  );
}

function expectFinancialAccountIdentifierPulled() {
  expect(mockUpsertFinancialAccountIdentifier).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      id: "fai-1",
      accountId: "fa-1",
      value: "1234",
    })
  );
}

function expectFinancialTableCursors() {
  expectCursorToEqual(
    "last_sync_at_financial_account_identifiers",
    createCursor("2026-04-18T12:00:00.000Z", "fai-1")
  );
  expectCursorToEqual(
    "last_sync_at_capture_evidence",
    createCursor("2026-04-18T08:00:00.000Z", "ce-1")
  );
}

function expectDismissalPulled() {
  expect(mockUpsertAccountSuggestionDismissal).toHaveBeenCalledWith(
    mockDb,
    expect.objectContaining({
      id: "asd-1",
      userId: "user-1",
      scope: "notification:bancolombia:last4",
      value: "1234",
      dismissedScore: 200,
    })
  );
  expectCursorToEqual(
    "last_sync_at_account_suggestion_dismissals",
    createCursor("2026-04-19T11:00:00.000Z", "asd-1")
  );
}

function expectCompositeTransactionsQuery(mockSupabase: any) {
  expect(mockSupabase._getChain("transactions").or).toHaveBeenCalledWith(
    "updated_at.gt.2026-04-18T12:00:00.000Z,and(updated_at.eq.2026-04-18T12:00:00.000Z,id.gt.tx-1000)"
  );
  expect(mockSupabase._getChain("transactions").order).toHaveBeenNthCalledWith(1, "updated_at", {
    ascending: true,
  });
  expect(mockSupabase._getChain("transactions").order).toHaveBeenNthCalledWith(2, "id", {
    ascending: true,
  });
}

describe("syncEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncPush", () => {
    it("does nothing when sync queue is empty", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([]);
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockClearSyncEntries).not.toHaveBeenCalled();
    });

    it("upserts transaction row to supabase and clears queue on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([createSyncQueueEntry()]);
      mockGetTransactionById.mockReturnValueOnce(
        createLocalTransaction({
          amount: 1500,
          description: "Lunch",
          date: "2026-03-04",
          createdAt: "2026-03-04T10:00:00.000Z",
          updatedAt: "2026-03-04T10:00:00.000Z",
        })
      );
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      await runSyncPush(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith("transactions");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "tx-1",
          user_id: "user-1",
          amount: 1500,
          account_id: "fa-default-user-1",
          account_attribution_state: "confirmed",
          superseded_at: null,
        })
      );
      expectQueueCleared("sq-1");
    });

    it("keeps entry in queue when supabase returns error", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        {
          id: "sq-1",
          tableName: "transactions",
          rowId: "tx-1",
          operation: "insert",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]);
      mockGetTransactionById.mockReturnValueOnce({
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amount: 1500,
        categoryId: "food",
        description: null,
        date: "2026-03-04",
        createdAt: "2026-03-04T10:00:00.000Z",
        updatedAt: "2026-03-04T10:00:00.000Z",
        deletedAt: null,
      });
      mockUpsert.mockReturnValueOnce({ error: { message: "network error" } });
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

      expect(mockClearSyncEntries).not.toHaveBeenCalled();
    });

    it("upserts financial account rows and clears the queue entry on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        createSyncQueueEntry({
          id: "sq-accounts-1",
          tableName: "financialAccounts",
          rowId: "fa-1",
        }),
      ]);
      mockGetFinancialAccountById.mockReturnValueOnce(createLocalFinancialAccount());
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      await runSyncPush(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith("financial_accounts");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "fa-1",
          user_id: "user-1",
          name: "Main wallet",
          kind: "wallet",
          is_default: true,
        })
      );
      expectQueueCleared("sq-accounts-1");
    });

    it("upserts account suggestion dismissal rows and clears the queue entry on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        createSyncQueueEntry({
          id: "sq-dismissal-1",
          tableName: "accountSuggestionDismissals",
          rowId: "asd-1",
          createdAt: "2026-04-19T10:00:00.000Z",
        }),
      ]);
      mockGetAccountSuggestionDismissalById.mockReturnValueOnce(
        createLocalAccountSuggestionDismissal()
      );
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      await runSyncPush(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith("account_suggestion_dismissals");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "asd-1",
          user_id: "user-1",
          scope: "notification:bancolombia:last4",
          value: "1234",
          dismissed_score: 200,
        }),
        { onConflict: "user_id,scope,value" }
      );
      expectQueueCleared("sq-dismissal-1");
    });

    it("upserts transfer rows and clears the queue entry on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        createSyncQueueEntry({
          id: "sq-transfer-1",
          tableName: "transfers",
          rowId: "tr-1",
        }),
      ]);
      mockGetTransferById.mockReturnValueOnce(createLocalTransfer());
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      await runSyncPush(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith("transfers");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "tr-1",
          user_id: "user-1",
          amount: 250000,
          from_account_id: "fa-1",
          to_account_id: "fa-2",
        })
      );
      expectQueueCleared("sq-transfer-1");
    });

    it("upserts opening balance rows and clears the queue entry on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        createSyncQueueEntry({
          id: "sq-opening-balance-1",
          tableName: "openingBalances",
          rowId: "ob-1",
        }),
      ]);
      mockGetOpeningBalanceById.mockReturnValueOnce(createLocalOpeningBalance());
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      await runSyncPush(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith("opening_balances");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ob-1",
          user_id: "user-1",
          account_id: "fa-1",
          amount: 500000,
          effective_date: "2026-04-01",
        }),
        { onConflict: "account_id" }
      );
      expectQueueCleared("sq-opening-balance-1");
    });

    it("upserts financial account identifier rows and clears the queue entry on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        createSyncQueueEntry({
          id: "sq-financial-identifier-1",
          tableName: "financialAccountIdentifiers",
          rowId: "fai-1",
        }),
      ]);
      mockGetFinancialAccountIdentifierById.mockReturnValueOnce(
        createLocalFinancialAccountIdentifier()
      );
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      await runSyncPush(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith("financial_account_identifiers");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "fai-1",
          user_id: "user-1",
          account_id: "fa-1",
          scope: "email:bancolombia:last4",
          value: "1234",
        }),
        { onConflict: "user_id,account_id,scope,value" }
      );
      expectQueueCleared("sq-financial-identifier-1");
    });

    it("upserts capture evidence rows and clears the queue entry on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        createSyncQueueEntry({
          id: "sq-capture-evidence-1",
          tableName: "captureEvidence",
          rowId: "ce-1",
          createdAt: "2026-04-19T10:00:00.000Z",
        }),
      ]);
      mockGetCaptureEvidenceById.mockReturnValueOnce(createLocalCaptureEvidence());
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      await runSyncPush(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith("capture_evidence");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ce-1",
          user_id: "user-1",
          source_family: "bancolombia",
          evidence_type: "last4",
          scope: "notification:bancolombia:last4",
          value: "1234",
          processed_capture_id: "pc-1",
        })
      );
      expectQueueCleared("sq-capture-evidence-1");
    });

    it("clears queue entry when local row is missing", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        {
          id: "sq-1",
          tableName: "transactions",
          rowId: "tx-gone",
          operation: "insert",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]);
      mockGetTransactionById.mockReturnValueOnce(null);
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

      expect(mockClearSyncEntries).toHaveBeenCalledWith(mockDb, ["sq-1"]);
    });
  });

  describe("syncPull", () => {
    it("fetches all rows on first sync and sets last_sync_at to max updated_at", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const mockSupabase = createTransactionPullSupabase({
        id: "tx-remote-1",
        type: "income",
        amount: 5000,
        category_id: "salary",
        description: "Pay",
        date: "2026-03-04",
        created_at: "2026-03-04T10:00:00.000Z",
        updated_at: "2026-03-04T12:00:00.000Z",
      });
      mockGetTransactionById.mockReturnValueOnce(null);

      const result = await runSyncPull(mockSupabase);

      expect(result).toBe(true);
      expectUpsertedTransaction({
        id: "tx-remote-1",
        userId: "user-1",
        accountId: "fa-default-user-1",
        accountAttributionState: "confirmed",
        supersededAt: null,
      });
      expectLastSyncAt("2026-03-04T12:00:00.000Z");
    });

    it("pulls financial-account tables and advances the shared sync cursor", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const mockSupabase = createFinancialTablesSupabase();
      mockGetCaptureEvidenceById.mockReturnValueOnce(null);
      mockGetFinancialAccountById.mockReturnValueOnce(null);
      mockGetTransferById.mockReturnValueOnce(null);
      mockGetOpeningBalanceById.mockReturnValueOnce(null);
      mockGetFinancialAccountIdentifierById.mockReturnValueOnce(null);

      const result = await runSyncPull(mockSupabase);

      expect(result).toBe(true);
      expectCaptureEvidencePulled();
      expectFinancialAccountPulled();
      expectTransferPulled();
      expectOpeningBalancePulled();
      expectFinancialAccountIdentifierPulled();
      expectFinancialTableCursors();
    });

    it("pulls account suggestion dismissals and advances their cursor", async () => {
      const mockSupabase = createDismissalPullSupabase();
      mockGetAccountSuggestionDismissalById.mockReturnValueOnce(null);

      const result = await runSyncPull(mockSupabase);

      expect(result).toBe(true);
      expectDismissalPulled();
    });

    it("tracks per-table cursors so a busy table is not skipped by a newer row elsewhere", async () => {
      mockGetSyncMeta.mockImplementation((_, key: string) =>
        key === "last_sync_at" ? "2026-04-01T00:00:00.000Z" : null
      );
      const mockSupabase = createBusyTableCursorSupabase();
      mockGetTransactionById.mockReturnValue(null);
      mockGetFinancialAccountById.mockReturnValue(null);

      const result = await runSyncPull(mockSupabase);

      expect(result).toBe(true);
      expectBusyTableCursorIsolation();
    });

    it("uses a composite cursor to continue past rows that share the same updated_at", async () => {
      const syncMeta = createCompositeSyncMeta("2026-04-18T12:00:00.000Z", "tx-1000");
      const mockSupabase = createSameTimestampTransactionSupabase();
      mockGetTransactionById.mockReturnValue(null);

      const result = await runSyncPull(mockSupabase);

      expect(result).toBe(true);
      expectCompositeTransactionsQuery(mockSupabase);
      expect(JSON.parse(syncMeta.get("last_sync_at_transactions")!)).toEqual(
        createCursor("2026-04-18T12:00:00.000Z", "tx-1002")
      );
    });

    it("uses last_sync_at for incremental pull and skips setSyncMeta when no rows", async () => {
      mockGetSyncMeta.mockImplementation(() => "2026-03-04T10:00:00.000Z");
      const mockSupabase = createMockSupabase({ data: [], error: null });

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      await syncPull(mockDb, mockSupabase, "user-1");

      expect(mockSupabase._getChain("transactions").gte).toHaveBeenCalled();
      expect(mockSupabase._getChain("capture_evidence").gte).toHaveBeenCalled();
      expect(mockSupabase._getChain("financial_accounts").gte).toHaveBeenCalled();
      expect(mockSupabase._getChain("transfers").gte).toHaveBeenCalled();
      expect(mockSupabase._getChain("opening_balances").gte).toHaveBeenCalled();
      expect(mockSupabase._getChain("financial_account_identifiers").gte).toHaveBeenCalled();
      expect(mockSetSyncMeta).not.toHaveBeenCalled();
    });

    it("does not manufacture a cursor for an empty first pull", async () => {
      mockGetSyncMeta.mockReturnValue(null);
      const mockSupabase = createMockSupabase({ data: [], error: null });

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      const result = await syncPull(mockDb, mockSupabase, "user-1");

      expect(result).toBe(true);
      expect(mockSetSyncMeta).not.toHaveBeenCalled();
    });

    it("continues when a secondary table fetch fails and still advances transactions", async () => {
      mockGetSyncMeta.mockReturnValue(null);
      const mockSupabase = createSecondaryFailureSupabase();
      mockGetTransactionById.mockReturnValueOnce(null);

      const result = await runSyncPull(mockSupabase);

      expect(result).toBe(true);
      expectUpsertedTransaction({ id: "tx-remote-1", userId: "user-1" });
      expect(getLastSetSyncMetaValue("last_sync_at_financial_accounts")).toBeNull();
      expectCursorToEqual(
        "last_sync_at_transactions",
        createCursor("2026-03-04T12:00:00.000Z", "tx-remote-1")
      );
    });

    it("skips upsert when local row is newer (LWW)", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const mockSupabase = createMockSupabase({
        data: [
          createServerTransactionRow({
            amount: 1000,
            description: null,
            date: "2026-03-04",
            created_at: "2026-03-04T10:00:00.000Z",
            updated_at: "2026-03-04T10:00:00.000Z",
          }),
        ],
        error: null,
      });
      mockGetTransactionById.mockReturnValueOnce(
        createLocalTransaction({
          amount: 2000,
          description: null,
          date: "2026-03-04",
          createdAt: "2026-03-04T10:00:00.000Z",
          updatedAt: "2026-03-04T12:00:00.000Z",
        })
      );

      await runSyncPull(mockSupabase);

      expect(mockUpsertTransaction).not.toHaveBeenCalled();
    });

    it("upserts when server row is newer", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const mockSupabase = createMockSupabase({
        data: [
          createServerTransactionRow({
            amount: 3000,
            description: "Updated",
            date: "2026-03-04",
            created_at: "2026-03-04T10:00:00.000Z",
            updated_at: "2026-03-04T14:00:00.000Z",
          }),
        ],
        error: null,
      });
      mockGetTransactionById.mockReturnValueOnce(
        createLocalTransaction({
          description: null,
          date: "2026-03-04",
          createdAt: "2026-03-04T10:00:00.000Z",
          updatedAt: "2026-03-04T10:00:00.000Z",
        })
      );

      await runSyncPull(mockSupabase);

      expect(mockUpsertTransaction).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ id: "tx-1", amount: 3000, description: "Updated" })
      );
    });

    it("returns false on supabase error and skips upsert", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const mockSupabase = createMockSupabase({ data: null, error: { message: "fail" } });

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      const result = await syncPull(mockDb, mockSupabase, "user-1");

      expect(result).toBe(false);
      expect(mockUpsertTransaction).not.toHaveBeenCalled();
      expect(mockSetSyncMeta).not.toHaveBeenCalled();
    });
  });

  describe("fullSync", () => {
    it("calls syncPull then syncPush when pull succeeds", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      mockGetQueuedSyncEntries.mockReturnValueOnce([]);
      const mockSupabase = createMockSupabase({ data: [], error: null });

      const { fullSync } = await import("@/features/sync/services/syncEngine");
      const result = await fullSync(mockDb, mockSupabase, "user-1");

      expect(result).toBe(true);
      expect(mockGetSyncMeta).toHaveBeenCalled();
      expect(mockGetQueuedSyncEntries).toHaveBeenCalled();
      expect(mockSetSyncMeta).not.toHaveBeenCalled();
    });

    it("skips push when pull fails and returns false", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const mockSupabase = createMockSupabase({ data: null, error: { message: "fail" } });

      const { fullSync } = await import("@/features/sync/services/syncEngine");
      const result = await fullSync(mockDb, mockSupabase, "user-1");

      expect(result).toBe(false);
      expect(mockGetSyncMeta).toHaveBeenCalled();
      expect(mockGetQueuedSyncEntries).not.toHaveBeenCalled();
    });

    it("still pushes when only a secondary pull table fails", async () => {
      mockGetSyncMeta.mockReturnValue(null);
      mockGetQueuedSyncEntries.mockReturnValueOnce([]);
      const mockSupabase = createMockSupabase({
        transactions: { data: [], error: null },
        financial_accounts: {
          data: null,
          error: { message: "accounts unavailable", code: "500" },
        },
        transfers: { data: [], error: null },
        opening_balances: { data: [], error: null },
        financial_account_identifiers: { data: [], error: null },
      });

      const { fullSync } = await import("@/features/sync/services/syncEngine");
      const result = await fullSync(mockDb, mockSupabase, "user-1");

      expect(result).toBe(true);
      expect(mockGetQueuedSyncEntries).toHaveBeenCalled();
    });
  });

  describe("conflict logging", () => {
    it("logs conflict when server overwrites local with different data", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const mockSupabase = createTransactionPullSupabase({
        amount: 2000,
        description: "Updated by server",
        date: "2026-03-04",
        created_at: "2026-03-04T10:00:00.000Z",
        updated_at: "2026-03-04T14:00:00.000Z",
      });
      mockGetTransactionById.mockReturnValueOnce(
        createLocalTransaction({
          description: "Local version",
          date: "2026-03-04",
          createdAt: "2026-03-04T10:00:00.000Z",
          updatedAt: "2026-03-04T10:00:00.000Z",
        })
      );

      await runSyncPull(mockSupabase);

      expectConflictLogged("tx-1");
      expect(mockUpsertTransaction).toHaveBeenCalled();
    });

    it("does not log conflict when data matches (only timestamp differs)", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const mockSupabase = createMockSupabase({
        data: [
          createServerTransactionRow({
            amount: 1000,
            description: "Same data",
            date: "2026-03-04",
            created_at: "2026-03-04T10:00:00.000Z",
            updated_at: "2026-03-04T14:00:00.000Z",
          }),
        ],
        error: null,
      });
      mockGetTransactionById.mockReturnValueOnce(
        createLocalTransaction({
          amount: 1000,
          description: "Same data",
          date: "2026-03-04",
          createdAt: "2026-03-04T10:00:00.000Z",
          updatedAt: "2026-03-04T10:00:00.000Z",
        })
      );

      await runSyncPull(mockSupabase);

      expect(mockInsertConflict).not.toHaveBeenCalled();
      expect(mockUpsertTransaction).toHaveBeenCalled();
    });

    it("does not log conflict for new server-only transactions", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const serverRows = [
        {
          id: "tx-new",
          user_id: "user-1",
          type: "expense",
          amount: 5000,
          category_id: "transport",
          description: "New from server",
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T10:00:00.000Z",
          deleted_at: null,
        },
      ];
      const mockSupabase = createMockSupabase({ data: serverRows, error: null });
      mockGetTransactionById.mockReturnValueOnce(null);

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      await syncPull(mockDb, mockSupabase, "user-1");

      expect(mockInsertConflict).not.toHaveBeenCalled();
      expect(mockUpsertTransaction).toHaveBeenCalled();
    });
  });
});
