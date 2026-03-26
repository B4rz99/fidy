// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryId, CopAmount, IsoDate, UserId } from "@/shared/types/branded";

const mockAll = vi.fn().mockReturnValue([]);
const mockGet = vi.fn().mockReturnValue(null);
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockGroupBy = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();

const mockDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
} as any;

describe("analytics repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(null);
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, all: mockAll, get: mockGet });
    mockWhere.mockReturnValue({
      all: mockAll,
      get: mockGet,
      groupBy: mockGroupBy,
      orderBy: mockOrderBy,
    });
    mockGroupBy.mockReturnValue({ all: mockAll, orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ all: mockAll });
  });

  describe("getIncomeExpenseForPeriod", () => {
    it("calls db.select, from, where, and get", async () => {
      const { getIncomeExpenseForPeriod } = await import("@/features/analytics/lib/repository");

      getIncomeExpenseForPeriod(
        mockDb,
        "user-1" as UserId,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      );

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
    });

    it("returns zero defaults when db returns null", async () => {
      mockGet.mockReturnValueOnce(null);

      const { getIncomeExpenseForPeriod } = await import("@/features/analytics/lib/repository");

      const result = getIncomeExpenseForPeriod(
        mockDb,
        "user-1" as UserId,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      );

      expect(result).toEqual({ income: 0, expenses: 0 });
    });

    it("returns zero defaults when row fields are null", async () => {
      mockGet.mockReturnValueOnce({ income: null, expenses: null });

      const { getIncomeExpenseForPeriod } = await import("@/features/analytics/lib/repository");

      const result = getIncomeExpenseForPeriod(
        mockDb,
        "user-1" as UserId,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      );

      expect(result).toEqual({ income: 0, expenses: 0 });
    });

    it("returns income and expenses from db row", async () => {
      mockGet.mockReturnValueOnce({ income: 500000, expenses: 350000 });

      const { getIncomeExpenseForPeriod } = await import("@/features/analytics/lib/repository");

      const result = getIncomeExpenseForPeriod(
        mockDb,
        "user-1" as UserId,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      );

      expect(result).toEqual({
        income: 500000 as CopAmount,
        expenses: 350000 as CopAmount,
      });
    });
  });

  describe("getSpendingByCategoryForPeriod", () => {
    it("calls db.select, from, where, groupBy, orderBy, and all", async () => {
      const { getSpendingByCategoryForPeriod } = await import(
        "@/features/analytics/lib/repository"
      );

      getSpendingByCategoryForPeriod(
        mockDb,
        "user-1" as UserId,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      );

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockGroupBy).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
    });

    it("returns empty array when db returns no rows", async () => {
      mockOrderBy.mockReturnValueOnce({ all: () => [] });

      const { getSpendingByCategoryForPeriod } = await import(
        "@/features/analytics/lib/repository"
      );

      const result = getSpendingByCategoryForPeriod(
        mockDb,
        "user-1" as UserId,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      );

      expect(result).toEqual([]);
    });

    it("returns category totals ordered by total descending", async () => {
      const mockRows = [
        { categoryId: "food" as CategoryId, total: 200000 as CopAmount },
        { categoryId: "transport" as CategoryId, total: 80000 as CopAmount },
      ];
      mockOrderBy.mockReturnValueOnce({ all: () => mockRows });

      const { getSpendingByCategoryForPeriod } = await import(
        "@/features/analytics/lib/repository"
      );

      const result = getSpendingByCategoryForPeriod(
        mockDb,
        "user-1" as UserId,
        "2026-03-01" as IsoDate,
        "2026-03-31" as IsoDate
      );

      expect(result).toEqual(mockRows);
      expect(result[0].categoryId).toBe("food");
      expect(result[0].total).toBe(200000);
    });
  });
});
