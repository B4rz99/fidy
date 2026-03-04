// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockResolvedValue([]);
const mockDelete = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([]);

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  orderBy: mockOrderBy,
  delete: mockDelete,
  where: mockWhere,
} as any;

describe("transaction repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockReturnThis();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ orderBy: mockOrderBy });
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  it("insertTransaction calls db.insert with correct row", async () => {
    const { insertTransaction } = await import("@/features/transactions/lib/repository");

    await insertTransaction(mockDb, {
      id: "tx-123",
      type: "expense",
      amountCents: 4520,
      categoryId: "food",
      description: "Groceries",
      date: "2026-03-04",
      createdAt: "2026-03-04T10:00:00.000Z",
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      id: "tx-123",
      type: "expense",
      amountCents: 4520,
      categoryId: "food",
      description: "Groceries",
      date: "2026-03-04",
      createdAt: "2026-03-04T10:00:00.000Z",
    });
  });

  it("getAllTransactions calls db.select().from().orderBy()", async () => {
    const mockRows = [
      {
        id: "tx-1",
        type: "expense",
        amountCents: 1000,
        categoryId: "food",
        description: null,
        date: "2026-03-04",
        createdAt: "2026-03-04T10:00:00.000Z",
      },
    ];
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const { getAllTransactions } = await import("@/features/transactions/lib/repository");

    const result = await getAllTransactions(mockDb);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
    expect(result).toEqual(mockRows);
  });

  it("deleteTransaction calls db.delete().where() with id", async () => {
    const { deleteTransaction } = await import("@/features/transactions/lib/repository");

    await deleteTransaction(mockDb, "tx-123");

    expect(mockDelete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});
