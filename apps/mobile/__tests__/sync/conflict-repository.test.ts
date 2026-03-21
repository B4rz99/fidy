// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IsoDateTime, SyncConflictId, TransactionId } from "@/shared/types/branded";

const mockRun = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockUpdateWhere = vi.fn().mockReturnThis();

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
} as any;

describe("conflict repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ run: mockRun });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ all: mockAll });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ run: mockRun });
  });

  it("insertConflict calls db.insert with correct values", async () => {
    const { insertConflict } = await import("@/features/sync/lib/conflict-repository");
    const row = {
      id: "conflict-1" as SyncConflictId,
      transactionId: "tx-1" as TransactionId,
      localData: '{"amount":1000}',
      serverData: '{"amount":2000}',
      detectedAt: "2026-03-15T10:00:00.000Z" as IsoDateTime,
    };

    insertConflict(mockDb, row);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(row);
    expect(mockRun).toHaveBeenCalled();
  });

  it("getUnresolvedConflicts queries for null resolvedAt", async () => {
    const mockConflicts = [
      {
        id: "conflict-1",
        transactionId: "tx-1",
        localData: "{}",
        serverData: "{}",
        detectedAt: "2026-03-15T10:00:00.000Z",
        resolvedAt: null,
        resolution: null,
      },
    ];
    mockAll.mockReturnValueOnce(mockConflicts);

    const { getUnresolvedConflicts } = await import("@/features/sync/lib/conflict-repository");
    const result = getUnresolvedConflicts(mockDb);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
    expect(result).toEqual(mockConflicts);
  });

  it("resolveConflict updates with resolvedAt and resolution", async () => {
    const { resolveConflict } = await import("@/features/sync/lib/conflict-repository");

    resolveConflict(
      mockDb,
      "conflict-1" as SyncConflictId,
      "local",
      "2026-03-15T12:00:00.000Z" as IsoDateTime
    );

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({
      resolvedAt: "2026-03-15T12:00:00.000Z",
      resolution: "local",
    });
    expect(mockRun).toHaveBeenCalled();
  });
});
