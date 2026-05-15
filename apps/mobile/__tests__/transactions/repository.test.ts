// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultFinancialAccountId } from "@/features/financial-accounts";
import type {
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const mockRun = vi.fn<(...args: any[]) => any>();
const mockAll = vi.fn<(...args: any[]) => any>().mockReturnValue([]);
const mockValues = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockInsert = vi.fn<(...args: any[]) => any>(() => ({ values: mockValues }));
const mockSelect = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockFrom = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockWhere = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockOrderBy = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockDelete = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockDeleteWhere = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockUpdate = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockSet = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockUpdateWhere = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockOnConflictDoUpdate = vi.fn<(...args: any[]) => any>().mockReturnThis();

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
      id: "tx-123" as TransactionId,
      userId: "user-1" as UserId,
      type: "expense",
      amount: 4520 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Groceries",
      date: "2026-03-04" as IsoDate,
      createdAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      id: "tx-123",
      userId: "user-1",
      type: "expense",
      amount: 4520,
      categoryId: "food",
      description: "Groceries",
      counterpartyName: null,
      date: "2026-03-04",
      accountId: buildDefaultFinancialAccountId("user-1" as UserId),
      accountAttributionState: "confirmed",
      source: "manual",
      supersededAt: null,
      supersededByTransferId: null,
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
        amount: 1000,
        categoryId: "food",
        description: null,
        date: "2026-03-04",
        createdAt: "2026-03-04T10:00:00.000Z",
        updatedAt: "2026-03-04T10:00:00.000Z",
        voidedAt: null,
      },
    ];
    mockAll.mockReturnValueOnce(mockRows);

    const { getAllTransactions } = await import("@/features/transactions/lib/repository");
    const result = getAllTransactions(mockDb, "user-1" as UserId);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
    expect(mockAll).toHaveBeenCalled();
    expect(result).toEqual(mockRows);
  });

  it("softDeleteTransaction sets voidedAt and updatedAt", async () => {
    const { softDeleteTransaction } = await import("@/features/transactions/lib/repository");

    softDeleteTransaction(
      mockDb,
      "tx-123" as TransactionId,
      "2026-03-04T10:00:00.000Z" as IsoDateTime
    );

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        voidedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    );
    expect(mockRun).toHaveBeenCalled();
  });

  it("getTransactionById returns the row when found", async () => {
    const mockRow = {
      id: "tx-1",
      userId: "user-1",
      type: "expense",
      amount: 1000,
      categoryId: "food",
      description: null,
      date: "2026-03-04",
      createdAt: "2026-03-04T10:00:00.000Z",
      updatedAt: "2026-03-04T10:00:00.000Z",
      voidedAt: null,
    };
    mockAll.mockReturnValueOnce([mockRow]);

    const { getTransactionById } = await import("@/features/transactions/lib/repository");
    const result = getTransactionById(mockDb, "tx-1" as TransactionId);

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual(mockRow);
  });

  it("getTransactionById returns null when not found", async () => {
    mockAll.mockReturnValueOnce([]);

    const { getTransactionById } = await import("@/features/transactions/lib/repository");
    const result = getTransactionById(mockDb, "tx-nonexistent" as TransactionId);

    expect(result).toBeNull();
  });

  it("upsertTransaction calls insert with onConflictDoUpdate", async () => {
    const { upsertTransaction } = await import("@/features/transactions/lib/repository");

    const row = {
      id: "tx-1" as TransactionId,
      userId: "user-1" as UserId,
      type: "expense" as const,
      amount: 2000 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Updated",
      date: "2026-03-04" as IsoDate,
      createdAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-04T12:00:00.000Z" as IsoDateTime,
      source: "email_gmail",
    };

    upsertTransaction(mockDb, row);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      ...row,
      accountId: buildDefaultFinancialAccountId("user-1" as UserId),
      accountAttributionState: "unresolved",
      source: "automated",
      supersededAt: null,
      supersededByTransferId: null,
      counterpartyName: null,
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          type: row.type,
          amount: row.amount,
          description: row.description,
          source: "automated",
        }),
      })
    );
    expect(mockRun).toHaveBeenCalled();
  });
});
