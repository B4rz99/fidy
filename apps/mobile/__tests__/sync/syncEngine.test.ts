// biome-ignore-all lint/suspicious/noExplicitAny: mock db/supabase need flexible typing
// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase API column names
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetQueuedSyncEntries = vi.fn().mockResolvedValue([]);
const mockClearSyncEntries = vi.fn();
const mockGetTransactionById = vi.fn().mockResolvedValue(null);
const mockGetSyncMeta = vi.fn().mockResolvedValue(null);
const mockSetSyncMeta = vi.fn();
const mockUpsertTransaction = vi.fn();

vi.mock("@/features/transactions/lib/repository", () => ({
  getQueuedSyncEntries: (...args: any[]) => mockGetQueuedSyncEntries(...args),
  clearSyncEntries: (...args: any[]) => mockClearSyncEntries(...args),
  getTransactionById: (...args: any[]) => mockGetTransactionById(...args),
  getSyncMeta: (...args: any[]) => mockGetSyncMeta(...args),
  setSyncMeta: (...args: any[]) => mockSetSyncMeta(...args),
  upsertTransaction: (...args: any[]) => mockUpsertTransaction(...args),
}));

const mockDb = {} as any;
const mockUpsert = vi.fn().mockReturnValue({ error: null });

function createMockSupabase(queryResult: { data: any; error: any } = { data: [], error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(queryResult),
  };
  // When gt is not called (no lastSyncAt), eq should also resolve via order().limit()
  chain.eq.mockReturnValue({ ...chain });
  chain.select.mockReturnValue(chain);

  return {
    from: vi.fn(() => ({
      upsert: mockUpsert,
      select: chain.select,
    })),
    _chain: chain,
  } as any;
}

describe("syncEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncPush", () => {
    it("does nothing when sync queue is empty", async () => {
      mockGetQueuedSyncEntries.mockResolvedValueOnce([]);
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockClearSyncEntries).not.toHaveBeenCalled();
    });

    it("upserts transaction row to supabase and clears queue on success", async () => {
      mockGetQueuedSyncEntries.mockResolvedValueOnce([
        {
          id: "sq-1",
          tableName: "transactions",
          rowId: "tx-1",
          operation: "insert",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]);
      mockGetTransactionById.mockResolvedValueOnce({
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amountCents: 1500,
        categoryId: "food",
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
          amount_cents: 1500,
        })
      );
      expect(mockClearSyncEntries).toHaveBeenCalledWith(mockDb, ["sq-1"]);
    });

    it("keeps entry in queue when supabase returns error", async () => {
      mockGetQueuedSyncEntries.mockResolvedValueOnce([
        {
          id: "sq-1",
          tableName: "transactions",
          rowId: "tx-1",
          operation: "insert",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]);
      mockGetTransactionById.mockResolvedValueOnce({
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amountCents: 1500,
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

    it("clears queue entry when local row is missing", async () => {
      mockGetQueuedSyncEntries.mockResolvedValueOnce([
        {
          id: "sq-1",
          tableName: "transactions",
          rowId: "tx-gone",
          operation: "insert",
          createdAt: "2026-03-04T10:00:00.000Z",
        },
      ]);
      mockGetTransactionById.mockResolvedValueOnce(null);
      const mockSupabase = createMockSupabase();

      const { syncPush } = await import("@/features/sync/services/syncEngine");
      await syncPush(mockDb, mockSupabase, "user-1");

      expect(mockClearSyncEntries).toHaveBeenCalledWith(mockDb, ["sq-1"]);
    });
  });

  describe("syncPull", () => {
    it("fetches all rows on first sync and sets last_sync_at to max updated_at", async () => {
      mockGetSyncMeta.mockResolvedValueOnce(null);
      const serverRows = [
        {
          id: "tx-remote-1",
          user_id: "user-1",
          type: "income",
          amount_cents: 5000,
          category_id: "salary",
          description: "Pay",
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T12:00:00.000Z",
          deleted_at: null,
        },
      ];
      const mockSupabase = createMockSupabase({ data: serverRows, error: null });
      mockGetTransactionById.mockResolvedValueOnce(null);

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      const result = await syncPull(mockDb, mockSupabase, "user-1");

      expect(result).toBe(true);
      expect(mockUpsertTransaction).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ id: "tx-remote-1", userId: "user-1" })
      );
      expect(mockSetSyncMeta).toHaveBeenCalledWith(
        mockDb,
        "last_sync_at",
        "2026-03-04T12:00:00.000Z"
      );
    });

    it("uses last_sync_at for incremental pull and skips setSyncMeta when no rows", async () => {
      mockGetSyncMeta.mockResolvedValueOnce("2026-03-04T10:00:00.000Z");
      const mockSupabase = createMockSupabase({ data: [], error: null });

      const { syncPull } = await import("@/features/sync/services/syncEngine");
      await syncPull(mockDb, mockSupabase, "user-1");

      expect(mockSupabase._chain.gt).toHaveBeenCalled();
      expect(mockSetSyncMeta).not.toHaveBeenCalled();
    });

    it("skips upsert when local row is newer (LWW)", async () => {
      mockGetSyncMeta.mockResolvedValueOnce(null);
      const serverRows = [
        {
          id: "tx-1",
          user_id: "user-1",
          type: "expense",
          amount_cents: 1000,
          category_id: "food",
          description: null,
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T10:00:00.000Z",
          deleted_at: null,
        },
      ];
      const mockSupabase = createMockSupabase({ data: serverRows, error: null });
      mockGetTransactionById.mockResolvedValueOnce({
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amountCents: 2000,
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
      mockGetSyncMeta.mockResolvedValueOnce(null);
      const serverRows = [
        {
          id: "tx-1",
          user_id: "user-1",
          type: "expense",
          amount_cents: 3000,
          category_id: "food",
          description: "Updated",
          date: "2026-03-04",
          created_at: "2026-03-04T10:00:00.000Z",
          updated_at: "2026-03-04T14:00:00.000Z",
          deleted_at: null,
        },
      ];
      const mockSupabase = createMockSupabase({ data: serverRows, error: null });
      mockGetTransactionById.mockResolvedValueOnce({
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amountCents: 1000,
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
        expect.objectContaining({ id: "tx-1", amountCents: 3000, description: "Updated" })
      );
    });

    it("returns false on supabase error and skips upsert", async () => {
      mockGetSyncMeta.mockResolvedValueOnce(null);
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
      mockGetSyncMeta.mockResolvedValueOnce(null);
      mockGetQueuedSyncEntries.mockResolvedValueOnce([]);
      const mockSupabase = createMockSupabase({ data: [], error: null });

      const { fullSync } = await import("@/features/sync/services/syncEngine");
      await fullSync(mockDb, mockSupabase, "user-1");

      expect(mockGetSyncMeta).toHaveBeenCalled();
      expect(mockGetQueuedSyncEntries).toHaveBeenCalled();
      expect(mockSetSyncMeta).toHaveBeenCalled();
    });

    it("skips push when pull fails", async () => {
      mockGetSyncMeta.mockResolvedValueOnce(null);
      const mockSupabase = createMockSupabase({ data: null, error: { message: "fail" } });

      const { fullSync } = await import("@/features/sync/services/syncEngine");
      await fullSync(mockDb, mockSupabase, "user-1");

      expect(mockGetSyncMeta).toHaveBeenCalled();
      expect(mockGetQueuedSyncEntries).not.toHaveBeenCalled();
    });
  });
});
