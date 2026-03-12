// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRun = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);
const mockValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();
const mockDeleteWhere = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockUpdateWhere = vi.fn().mockReturnThis();
const mockOnConflictDoUpdate = vi.fn().mockReturnThis();

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
    mockRun.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate, run: mockRun });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy, all: mockAll });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, all: mockAll });
    mockOrderBy.mockReturnValue({ all: mockAll });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockReturnValue({ run: mockRun });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ run: mockRun });
    mockInsert.mockReturnValue({ values: mockValues });
    mockOnConflictDoUpdate.mockReturnValue({ run: mockRun });
  });

  it("insertTransaction calls db.insert with correct row", async () => {
    const { insertTransaction } = await import("@/features/transactions/lib/repository");

    insertTransaction(mockDb, {
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
    expect(mockRun).toHaveBeenCalled();
  });

  it("getAllTransactions filters by userId and excludes deleted", async () => {
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
    mockAll.mockReturnValueOnce(mockRows);

    const { getAllTransactions } = await import("@/features/transactions/lib/repository");
    const result = getAllTransactions(mockDb, "user-1");

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
    expect(mockAll).toHaveBeenCalled();
    expect(result).toEqual(mockRows);
  });

  it("softDeleteTransaction sets deletedAt and updatedAt", async () => {
    const { softDeleteTransaction } = await import("@/features/transactions/lib/repository");

    softDeleteTransaction(mockDb, "tx-123", "2026-03-04T10:00:00.000Z");

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    );
    expect(mockRun).toHaveBeenCalled();
  });

  it("enqueueSync inserts into sync_queue", async () => {
    const { enqueueSync } = await import("@/features/transactions/lib/repository");

    enqueueSync(mockDb, {
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
    expect(mockRun).toHaveBeenCalled();
  });

  it("getQueuedSyncEntries returns all queue entries", async () => {
    const mockEntries = [
      { id: "sq-1", tableName: "transactions", rowId: "tx-1", operation: "insert" },
    ];
    mockFrom.mockReturnValueOnce({ all: () => mockEntries });

    const { getQueuedSyncEntries } = await import("@/features/transactions/lib/repository");
    const result = getQueuedSyncEntries(mockDb);

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual(mockEntries);
  });

  it("clearSyncEntries deletes entries by id in a single query", async () => {
    const { clearSyncEntries } = await import("@/features/transactions/lib/repository");

    clearSyncEntries(mockDb, ["sq-1", "sq-2"]);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalled();
  });

  it("clearSyncEntries does nothing for empty array", async () => {
    const { clearSyncEntries } = await import("@/features/transactions/lib/repository");

    clearSyncEntries(mockDb, []);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("setSyncMeta upserts key-value pair", async () => {
    const { setSyncMeta } = await import("@/features/transactions/lib/repository");

    setSyncMeta(mockDb, "last_sync_at", "2026-03-04T10:00:00.000Z");

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      key: "last_sync_at",
      value: "2026-03-04T10:00:00.000Z",
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
  });

  it("getSyncMeta returns value for existing key", async () => {
    mockAll.mockReturnValueOnce([{ key: "last_sync_at", value: "2026-03-04T10:00:00.000Z" }]);

    const { getSyncMeta } = await import("@/features/transactions/lib/repository");
    const result = getSyncMeta(mockDb, "last_sync_at");

    expect(result).toBe("2026-03-04T10:00:00.000Z");
  });

  it("getTransactionById returns the row when found", async () => {
    const mockRow = {
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
    };
    mockAll.mockReturnValueOnce([mockRow]);

    const { getTransactionById } = await import("@/features/transactions/lib/repository");
    const result = getTransactionById(mockDb, "tx-1");

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual(mockRow);
  });

  it("getTransactionById returns null when not found", async () => {
    mockAll.mockReturnValueOnce([]);

    const { getTransactionById } = await import("@/features/transactions/lib/repository");
    const result = getTransactionById(mockDb, "tx-nonexistent");

    expect(result).toBeNull();
  });

  it("upsertTransaction calls insert with onConflictDoUpdate", async () => {
    const { upsertTransaction } = await import("@/features/transactions/lib/repository");

    const row = {
      id: "tx-1",
      userId: "user-1",
      type: "expense" as const,
      amountCents: 2000,
      categoryId: "food",
      description: "Updated",
      date: "2026-03-04",
      createdAt: "2026-03-04T10:00:00.000Z",
      updatedAt: "2026-03-04T12:00:00.000Z",
    };

    upsertTransaction(mockDb, row);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(row);
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          type: row.type,
          amountCents: row.amountCents,
          description: row.description,
        }),
      })
    );
    expect(mockRun).toHaveBeenCalled();
  });

  it("getSyncMeta returns null for missing key", async () => {
    mockAll.mockReturnValueOnce([]);

    const { getSyncMeta } = await import("@/features/transactions/lib/repository");
    const result = getSyncMeta(mockDb, "nonexistent");

    expect(result).toBeNull();
  });
});
