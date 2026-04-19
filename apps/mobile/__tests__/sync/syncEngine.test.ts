// biome-ignore-all lint/suspicious/noExplicitAny: mock db/supabase need flexible typing
// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase API column names
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetQueuedSyncEntries = vi.fn().mockReturnValue([]);
const mockClearSyncEntries = vi.fn();
const mockGetTransactionById = vi.fn().mockReturnValue(null);
const mockGetFinancialAccountById = vi.fn().mockReturnValue(null);
const mockGetFinancialAccountIdentifierById = vi.fn().mockReturnValue(null);
const mockGetOpeningBalanceById = vi.fn().mockReturnValue(null);
const mockGetOpeningBalanceForAccount = vi.fn().mockReturnValue(null);
const mockGetTransferById = vi.fn().mockReturnValue(null);
const mockGetSyncMeta = vi.fn().mockReturnValue(null);
const mockSetSyncMeta = vi.fn();
const mockUpsertTransaction = vi.fn();
const mockInsertTransaction = vi.fn();
const mockUpsertFinancialAccount = vi.fn();
const mockUpsertFinancialAccountIdentifier = vi.fn();
const mockUpsertOpeningBalance = vi.fn();
const mockUpsertTransfer = vi.fn();

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

vi.mock("@/features/financial-accounts", () => ({
  buildDefaultFinancialAccountId: (userId: string) => `fa-default-${userId}`,
  getFinancialAccountById: (...args: any[]) => mockGetFinancialAccountById(...args),
  upsertFinancialAccount: (...args: any[]) => mockUpsertFinancialAccount(...args),
  getFinancialAccountIdentifierById: (...args: any[]) =>
    mockGetFinancialAccountIdentifierById(...args),
  upsertFinancialAccountIdentifier: (...args: any[]) =>
    mockUpsertFinancialAccountIdentifier(...args),
  getOpeningBalanceById: (...args: any[]) => mockGetOpeningBalanceById(...args),
  getOpeningBalanceForAccount: (...args: any[]) => mockGetOpeningBalanceForAccount(...args),
  upsertOpeningBalance: (...args: any[]) => mockUpsertOpeningBalance(...args),
}));

vi.mock("@/features/transfers", () => ({
  getTransferById: (...args: any[]) => mockGetTransferById(...args),
  upsertTransfer: (...args: any[]) => mockUpsertTransfer(...args),
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
        accountId: "fa-default-user-1",
        accountAttributionState: "confirmed",
        supersededAt: null,
        description: "Lunch",
        date: "2026-03-04",
        createdAt: "2026-03-04T10:00:00.000Z",
        updatedAt: "2026-03-04T10:00:00.000Z",
        deletedAt: null,
      });
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

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
      expect(mockClearSyncEntries).toHaveBeenCalledWith(mockDb, ["sq-1"]);
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
        {
          id: "sq-accounts-1",
          tableName: "financialAccounts",
          rowId: "fa-1",
          operation: "insert",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]);
      mockGetFinancialAccountById.mockReturnValueOnce({
        id: "fa-1",
        userId: "user-1",
        name: "Main wallet",
        kind: "wallet",
        isDefault: true,
        createdAt: "2026-03-04T10:00:00.000Z",
        updatedAt: "2026-03-04T10:00:00.000Z",
        deletedAt: null,
      });
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

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
      expect(mockClearSyncEntries).toHaveBeenCalledWith(mockDb, ["sq-accounts-1"]);
    });

    it("upserts transfer rows and clears the queue entry on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        {
          id: "sq-transfer-1",
          tableName: "transfers",
          rowId: "tr-1",
          operation: "insert",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]);
      mockGetTransferById.mockReturnValueOnce({
        id: "tr-1",
        userId: "user-1",
        amount: 250000,
        fromAccountId: "fa-1",
        toAccountId: "fa-2",
        fromExternalLabel: null,
        toExternalLabel: null,
        description: "Move to savings",
        date: "2026-04-18",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
        deletedAt: null,
      });
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

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
      expect(mockClearSyncEntries).toHaveBeenCalledWith(mockDb, ["sq-transfer-1"]);
    });

    it("upserts opening balance rows and clears the queue entry on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        {
          id: "sq-opening-balance-1",
          tableName: "openingBalances",
          rowId: "ob-1",
          operation: "insert",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]);
      mockGetOpeningBalanceById.mockReturnValueOnce({
        id: "ob-1",
        userId: "user-1",
        accountId: "fa-1",
        amount: 500000,
        effectiveDate: "2026-04-01",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
        deletedAt: null,
      });
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

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
      expect(mockClearSyncEntries).toHaveBeenCalledWith(mockDb, ["sq-opening-balance-1"]);
    });

    it("upserts financial account identifier rows and clears the queue entry on success", async () => {
      mockGetQueuedSyncEntries.mockReturnValueOnce([
        {
          id: "sq-financial-identifier-1",
          tableName: "financialAccountIdentifiers",
          rowId: "fai-1",
          operation: "insert",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]);
      mockGetFinancialAccountIdentifierById.mockReturnValueOnce({
        id: "fai-1",
        userId: "user-1",
        accountId: "fa-1",
        scope: "email:bancolombia:last4",
        value: "1234",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
        deletedAt: null,
      });
      mockUpsert.mockReturnValueOnce({ error: null });
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

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
      expect(mockClearSyncEntries).toHaveBeenCalledWith(mockDb, ["sq-financial-identifier-1"]);
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
      const serverRows = [
        {
          id: "tx-remote-1",
          user_id: "user-1",
          type: "income",
          amount: 5000,
          category_id: "salary",
          account_id: "fa-default-user-1",
          account_attribution_state: "confirmed",
          superseded_at: null,
          description: "Pay",
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T12:00:00.000Z",
          deleted_at: null,
        },
      ];
      const mockSupabase = createMockSupabase({ data: serverRows, error: null });
      mockGetTransactionById.mockReturnValueOnce(null);

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      const result = await syncPull(mockDb, mockSupabase, "user-1");

      expect(result).toBe(true);
      expect(mockUpsertTransaction).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          id: "tx-remote-1",
          userId: "user-1",
          accountId: "fa-default-user-1",
          accountAttributionState: "confirmed",
          supersededAt: null,
        })
      );
      expect(mockSetSyncMeta).toHaveBeenCalledWith(
        mockDb,
        "last_sync_at",
        "2026-03-04T12:00:00.000Z"
      );
    });

    it("pulls financial-account tables and advances the shared sync cursor", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const mockSupabase = createMockSupabase({
        transactions: { data: [], error: null },
        financial_accounts: {
          data: [
            {
              id: "fa-1",
              user_id: "user-1",
              name: "Main wallet",
              kind: "wallet",
              is_default: true,
              created_at: "2026-04-18T08:00:00.000Z",
              updated_at: "2026-04-18T09:00:00.000Z",
              deleted_at: null,
            },
          ],
          error: null,
        },
        transfers: {
          data: [
            {
              id: "tr-1",
              user_id: "user-1",
              amount: 250000,
              from_account_id: "fa-1",
              to_account_id: "fa-2",
              from_external_label: null,
              to_external_label: null,
              description: "Move to savings",
              date: "2026-04-18",
              created_at: "2026-04-18T09:30:00.000Z",
              updated_at: "2026-04-18T10:00:00.000Z",
              deleted_at: null,
            },
          ],
          error: null,
        },
        opening_balances: {
          data: [
            {
              id: "ob-1",
              user_id: "user-1",
              account_id: "fa-1",
              amount: 500000,
              effective_date: "2026-04-01",
              created_at: "2026-04-18T10:30:00.000Z",
              updated_at: "2026-04-18T11:00:00.000Z",
              deleted_at: null,
            },
          ],
          error: null,
        },
        financial_account_identifiers: {
          data: [
            {
              id: "fai-1",
              user_id: "user-1",
              account_id: "fa-1",
              scope: "email:bancolombia:last4",
              value: "1234",
              created_at: "2026-04-18T11:30:00.000Z",
              updated_at: "2026-04-18T12:00:00.000Z",
              deleted_at: null,
            },
          ],
          error: null,
        },
      });
      mockGetFinancialAccountById.mockReturnValueOnce(null);
      mockGetTransferById.mockReturnValueOnce(null);
      mockGetOpeningBalanceById.mockReturnValueOnce(null);
      mockGetFinancialAccountIdentifierById.mockReturnValueOnce(null);

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      const result = await syncPull(mockDb, mockSupabase, "user-1");

      expect(result).toBe(true);
      expect(mockUpsertFinancialAccount).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          id: "fa-1",
          userId: "user-1",
          isDefault: true,
        })
      );
      expect(mockUpsertTransfer).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          id: "tr-1",
          fromAccountId: "fa-1",
          toAccountId: "fa-2",
        })
      );
      expect(mockUpsertOpeningBalance).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          id: "ob-1",
          accountId: "fa-1",
          amount: 500000,
        })
      );
      expect(mockUpsertFinancialAccountIdentifier).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          id: "fai-1",
          accountId: "fa-1",
          value: "1234",
        })
      );
      expect(
        JSON.parse(getLastSetSyncMetaValue("last_sync_at_financial_account_identifiers")!)
      ).toEqual({
        updatedAt: "2026-04-18T12:00:00.000Z",
        id: "fai-1",
      });
    });

    it("tracks per-table cursors so a busy table is not skipped by a newer row elsewhere", async () => {
      mockGetSyncMeta.mockImplementation((_, key: string) =>
        key === "last_sync_at" ? "2026-04-01T00:00:00.000Z" : null
      );
      const transactionRows = Array.from({ length: 1000 }, (_, index) => {
        const hour = String(index).padStart(4, "0");
        return {
          id: `tx-${index + 1}`,
          user_id: "user-1",
          type: "expense",
          amount: 1000,
          category_id: "food",
          description: null,
          date: "2026-04-18",
          created_at: `2026-04-18T${hour}:00:00.000Z`,
          updated_at: `2026-04-18T${hour}:00:00.000Z`,
          deleted_at: null,
        };
      });
      const mockSupabase = createMockSupabase({
        transactions: { data: transactionRows, error: null },
        financial_accounts: {
          data: [
            {
              id: "fa-1",
              user_id: "user-1",
              name: "Main wallet",
              kind: "wallet",
              is_default: true,
              created_at: "2026-04-19T00:00:00.000Z",
              updated_at: "2026-04-19T00:00:00.000Z",
              deleted_at: null,
            },
          ],
          error: null,
        },
      });
      mockGetTransactionById.mockReturnValue(null);
      mockGetFinancialAccountById.mockReturnValue(null);

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      const result = await syncPull(mockDb, mockSupabase, "user-1");

      expect(result).toBe(true);
      expect(JSON.parse(getLastSetSyncMetaValue("last_sync_at_transactions")!)).toEqual({
        updatedAt: "2026-04-18T0999:00:00.000Z",
        id: "tx-1000",
      });
      expect(mockSetSyncMeta).toHaveBeenCalledWith(
        mockDb,
        "last_sync_at",
        "2026-04-18T0999:00:00.000Z"
      );
      expect(JSON.parse(getLastSetSyncMetaValue("last_sync_at_financial_accounts")!)).toEqual({
        updatedAt: "2026-04-19T00:00:00.000Z",
        id: "fa-1",
      });
      expect(getLastSetSyncMetaValue("last_sync_at_transactions")).not.toContain(
        "2026-04-19T00:00:00.000Z"
      );
    });

    it("uses a composite cursor to continue past rows that share the same updated_at", async () => {
      const syncMeta = new Map<string, string>([
        [
          "last_sync_at_transactions",
          JSON.stringify({
            updatedAt: "2026-04-18T12:00:00.000Z",
            id: "tx-1000",
          }),
        ],
      ]);
      mockGetSyncMeta.mockImplementation((_, key: string) => syncMeta.get(key) ?? null);
      mockSetSyncMeta.mockImplementation((_, key: string, value: string) => {
        syncMeta.set(key, value);
      });
      const mockSupabase = createMockSupabase({
        transactions: {
          data: [
            {
              id: "tx-1001",
              user_id: "user-1",
              type: "expense",
              amount: 1000,
              category_id: "food",
              description: null,
              date: "2026-04-18",
              created_at: "2026-04-18T12:00:00.000Z",
              updated_at: "2026-04-18T12:00:00.000Z",
              deleted_at: null,
            },
            {
              id: "tx-1002",
              user_id: "user-1",
              type: "expense",
              amount: 1000,
              category_id: "food",
              description: null,
              date: "2026-04-18",
              created_at: "2026-04-18T12:00:00.000Z",
              updated_at: "2026-04-18T12:00:00.000Z",
              deleted_at: null,
            },
          ],
          error: null,
        },
      });
      mockGetTransactionById.mockReturnValue(null);

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      const result = await syncPull(mockDb, mockSupabase, "user-1");

      expect(result).toBe(true);
      expect(mockSupabase._getChain("transactions").or).toHaveBeenCalledWith(
        "updated_at.gt.2026-04-18T12:00:00.000Z,and(updated_at.eq.2026-04-18T12:00:00.000Z,id.gt.tx-1000)"
      );
      expect(mockSupabase._getChain("transactions").order).toHaveBeenNthCalledWith(
        1,
        "updated_at",
        {
          ascending: true,
        }
      );
      expect(mockSupabase._getChain("transactions").order).toHaveBeenNthCalledWith(2, "id", {
        ascending: true,
      });
      expect(JSON.parse(syncMeta.get("last_sync_at_transactions")!)).toEqual({
        updatedAt: "2026-04-18T12:00:00.000Z",
        id: "tx-1002",
      });
    });

    it("uses last_sync_at for incremental pull and skips setSyncMeta when no rows", async () => {
      mockGetSyncMeta.mockImplementation(() => "2026-03-04T10:00:00.000Z");
      const mockSupabase = createMockSupabase({ data: [], error: null });

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      await syncPull(mockDb, mockSupabase, "user-1");

      expect(mockSupabase._getChain("transactions").gte).toHaveBeenCalled();
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

    it("skips upsert when local row is newer (LWW)", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const serverRows = [
        {
          id: "tx-1",
          user_id: "user-1",
          type: "expense",
          amount: 1000,
          category_id: "food",
          description: null,
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T10:00:00.000Z",
          deleted_at: null,
        },
      ];
      const mockSupabase = createMockSupabase({ data: serverRows, error: null });
      mockGetTransactionById.mockReturnValueOnce({
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amount: 2000,
        categoryId: "food",
        description: null,
        date: "2026-03-04",
        createdAt: "2026-03-04T10:00:00.000Z",
        updatedAt: "2026-03-04T12:00:00.000Z",
        deletedAt: null,
      });

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      await syncPull(mockDb, mockSupabase, "user-1");

      expect(mockUpsertTransaction).not.toHaveBeenCalled();
    });

    it("upserts when server row is newer", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const serverRows = [
        {
          id: "tx-1",
          user_id: "user-1",
          type: "expense",
          amount: 3000,
          category_id: "food",
          description: "Updated",
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T14:00:00.000Z",
          deleted_at: null,
        },
      ];
      const mockSupabase = createMockSupabase({ data: serverRows, error: null });
      mockGetTransactionById.mockReturnValueOnce({
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amount: 1000,
        categoryId: "food",
        description: null,
        date: "2026-03-04",
        createdAt: "2026-03-04T10:00:00.000Z",
        updatedAt: "2026-03-04T10:00:00.000Z",
        deletedAt: null,
      });

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      await syncPull(mockDb, mockSupabase, "user-1");

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
  });

  describe("conflict logging", () => {
    it("logs conflict when server overwrites local with different data", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const serverRows = [
        {
          id: "tx-1",
          user_id: "user-1",
          type: "expense",
          amount: 2000,
          category_id: "food",
          description: "Updated by server",
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T14:00:00.000Z",
          deleted_at: null,
        },
      ];
      const mockSupabase = createMockSupabase({ data: serverRows, error: null });
      mockGetTransactionById.mockReturnValueOnce({
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amount: 1000,
        categoryId: "food",
        description: "Local version",
        date: "2026-03-04",
        createdAt: "2026-03-04T10:00:00.000Z",
        updatedAt: "2026-03-04T10:00:00.000Z",
        deletedAt: null,
        source: "manual",
      });

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      await syncPull(mockDb, mockSupabase, "user-1");

      expect(mockInsertConflict).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          transactionId: "tx-1",
        })
      );
      expect(mockUpsertTransaction).toHaveBeenCalled();
    });

    it("does not log conflict when data matches (only timestamp differs)", async () => {
      mockGetSyncMeta.mockReturnValueOnce(null);
      const serverRows = [
        {
          id: "tx-1",
          user_id: "user-1",
          type: "expense",
          amount: 1000,
          category_id: "food",
          description: "Same data",
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T14:00:00.000Z",
          deleted_at: null,
        },
      ];
      const mockSupabase = createMockSupabase({ data: serverRows, error: null });
      mockGetTransactionById.mockReturnValueOnce({
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amount: 1000,
        categoryId: "food",
        description: "Same data",
        date: "2026-03-04",
        createdAt: "2026-03-04T10:00:00.000Z",
        updatedAt: "2026-03-04T10:00:00.000Z",
        deletedAt: null,
        source: "manual",
      });

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      await syncPull(mockDb, mockSupabase, "user-1");

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
