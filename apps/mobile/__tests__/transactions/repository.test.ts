// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockResolvedValue([]);
const mockDelete = vi.fn().mockReturnThis();
const mockDeleteWhere = vi.fn().mockResolvedValue([]);
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockUpdateWhere = vi.fn().mockResolvedValue([]);
const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
  delete: mockDelete,
  update: mockUpdate,
} as any;

describe("transaction repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockReturnThis();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  });

  it("insertTransaction calls db.insert with correct row", async () => {
    const { insertTransaction } = await import("@/features/transactions/lib/repository");

    await insertTransaction(mockDb, {
      id: "tx-123",
      userId: "user-1",
      type: "expense",
      amountCents: 4520,
      categoryId: "food",
      description: "Groceries",
      date: "2026-03-04",
      createdAt: "2026-03-04T10:00:00.000Z",
      updatedAt: "2026-03-04T10:00:00.000Z",
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      id: "tx-123",
      userId: "user-1",
      type: "expense",
      amountCents: 4520,
      categoryId: "food",
      description: "Groceries",
      date: "2026-03-04",
      createdAt: "2026-03-04T10:00:00.000Z",
      updatedAt: "2026-03-04T10:00:00.000Z",
    });
  });

  it("getAllTransactions filters by userId and excludes deleted", async () => {
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    const mockRows = [
      {
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
      },
    ];
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const { getAllTransactions } = await import("@/features/transactions/lib/repository");
    const result = await getAllTransactions(mockDb, "user-1");

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
    expect(result).toEqual(mockRows);
  });

  it("softDeleteTransaction sets deletedAt and updatedAt", async () => {
    const { softDeleteTransaction } = await import("@/features/transactions/lib/repository");

    await softDeleteTransaction(mockDb, "tx-123");

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    );
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("enqueueSync inserts into sync_queue", async () => {
    const { enqueueSync } = await import("@/features/transactions/lib/repository");

    await enqueueSync(mockDb, {
      id: "sq-1",
      tableName: "transactions",
      rowId: "tx-123",
      operation: "insert",
      createdAt: "2026-03-04T10:00:00.000Z",
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      id: "sq-1",
      tableName: "transactions",
      rowId: "tx-123",
      operation: "insert",
      createdAt: "2026-03-04T10:00:00.000Z",
    });
  });

  it("getQueuedSyncEntries returns all queue entries", async () => {
    const mockEntries = [
      { id: "sq-1", tableName: "transactions", rowId: "tx-1", operation: "insert" },
    ];
    mockFrom.mockResolvedValueOnce(mockEntries);

    const { getQueuedSyncEntries } = await import("@/features/transactions/lib/repository");
    const result = await getQueuedSyncEntries(mockDb);

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual(mockEntries);
  });

  it("clearSyncEntries deletes entries by id in a single query", async () => {
    const { clearSyncEntries } = await import("@/features/transactions/lib/repository");

    await clearSyncEntries(mockDb, ["sq-1", "sq-2"]);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
  });

  it("clearSyncEntries does nothing for empty array", async () => {
    const { clearSyncEntries } = await import("@/features/transactions/lib/repository");

    await clearSyncEntries(mockDb, []);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("setSyncMeta upserts key-value pair", async () => {
    const { setSyncMeta } = await import("@/features/transactions/lib/repository");

    await setSyncMeta(mockDb, "last_sync_at", "2026-03-04T10:00:00.000Z");

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      key: "last_sync_at",
      value: "2026-03-04T10:00:00.000Z",
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("getSyncMeta returns value for existing key", async () => {
    mockWhere.mockResolvedValueOnce([{ key: "last_sync_at", value: "2026-03-04T10:00:00.000Z" }]);

    const { getSyncMeta } = await import("@/features/transactions/lib/repository");
    const result = await getSyncMeta(mockDb, "last_sync_at");

    expect(result).toBe("2026-03-04T10:00:00.000Z");
  });

  it("getSyncMeta returns null for missing key", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { getSyncMeta } = await import("@/features/transactions/lib/repository");
    const result = await getSyncMeta(mockDb, "nonexistent");

    expect(result).toBeNull();
  });
});
