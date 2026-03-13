import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAll = vi.fn().mockReturnValue([]);
const mockLimit = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockGroupBy = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();

// biome-ignore lint/suspicious/noExplicitAny: mock db needs flexible typing
const mockDb = {
  select: mockSelect,
} as any;

describe("paginated repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, groupBy: mockGroupBy, orderBy: mockOrderBy, all: mockAll });
    mockWhere.mockReturnValue({ groupBy: mockGroupBy, orderBy: mockOrderBy, all: mockAll });
    mockGroupBy.mockReturnValue({ orderBy: mockOrderBy, all: mockAll });
    mockOrderBy.mockReturnValue({ all: mockAll, limit: mockLimit });
    mockLimit.mockReturnValue({ all: mockAll });
  });

  describe("getBalance", () => {
    it("calls db.select and returns numeric balance", async () => {
      const { getBalance } = await import("@/features/transactions/lib/repository");
      mockAll.mockReturnValueOnce([{ balance: 5000 }]);
      const result = getBalance(mockDb, "user-1");
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toBe(5000);
    });

    it("returns 0 when sum is null (no transactions)", async () => {
      const { getBalance } = await import("@/features/transactions/lib/repository");
      mockAll.mockReturnValueOnce([{ balance: null }]);
      const result = getBalance(mockDb, "user-1");
      expect(result).toBe(0);
    });
  });

  describe("getCategorySpending", () => {
    it("returns grouped spending by category", async () => {
      const { getCategorySpending } = await import("@/features/transactions/lib/repository");
      const mockResult = [
        { categoryId: "food", totalCents: 3000 },
        { categoryId: "transport", totalCents: 1500 },
      ];
      mockAll.mockReturnValueOnce(mockResult);
      const result = getCategorySpending(mockDb, "user-1", "2026-03-01", "2026-03-31");
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe("getDailySpending", () => {
    it("returns grouped spending by date", async () => {
      const { getDailySpending } = await import("@/features/transactions/lib/repository");
      const mockResult = [
        { date: "2026-03-01", totalCents: 2000 },
        { date: "2026-03-02", totalCents: 1000 },
      ];
      mockAll.mockReturnValueOnce(mockResult);
      const result = getDailySpending(mockDb, "user-1", "2026-02-11", "2026-03-13");
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe("getTransactionPage", () => {
    it("returns first page when cursor is null", async () => {
      const { getTransactionPage } = await import("@/features/transactions/lib/repository");
      mockAll.mockReturnValueOnce([]);
      const result = getTransactionPage(mockDb, "user-1", null, 50);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(result).toEqual([]);
    });

    it("applies cursor filter when cursor is provided", async () => {
      const { getTransactionPage } = await import("@/features/transactions/lib/repository");
      const cursor = { date: "2026-03-10", createdAt: "2026-03-10T10:00:00.000Z", id: "tx-100" };
      mockAll.mockReturnValueOnce([]);
      const result = getTransactionPage(mockDb, "user-1", cursor, 50);
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("maps raw rows through toStoredTransaction", async () => {
      const { getTransactionPage } = await import("@/features/transactions/lib/repository");
      const rawRow = {
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amountCents: 4520,
        categoryId: "food",
        description: "Groceries",
        date: "2026-03-10",
        createdAt: "2026-03-10T10:00:00.000Z",
        updatedAt: "2026-03-10T10:00:00.000Z",
        deletedAt: null,
      };
      mockAll.mockReturnValueOnce([rawRow]);
      const result = getTransactionPage(mockDb, "user-1", null, 50);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("tx-1");
      expect(result[0].date).toBeInstanceOf(Date);
      expect(result[0].amountCents).toBe(4520);
    });
  });
});
