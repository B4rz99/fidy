// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IsoDateTime, UserCategoryId, UserId } from "@/shared/types/branded";

const mockRun = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);
const mockValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
} as any;

describe("user categories repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
    mockValues.mockReturnValue({ run: mockRun });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, all: mockAll });
    mockWhere.mockReturnValue({ all: mockAll });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  describe("insertUserCategory", () => {
    it("calls db.insert with the correct row", async () => {
      const { insertUserCategory } = await import("@/features/categories/lib/repository");

      const row = {
        id: "ucat-1" as UserCategoryId,
        userId: "user-1" as UserId,
        name: "Groceries",
        iconName: "cart",
        colorHex: "#4CAF50",
        createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        deletedAt: null,
      };

      insertUserCategory(mockDb, row);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(row);
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("getUserCategoriesForUser", () => {
    it("filters by userId and excludes soft-deleted", async () => {
      const mockRows = [
        {
          id: "ucat-1",
          userId: "user-1",
          name: "Groceries",
          iconName: "cart",
          colorHex: "#4CAF50",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          deletedAt: null,
        },
      ];
      mockAll.mockReturnValueOnce(mockRows);

      const { getUserCategoriesForUser } = await import("@/features/categories/lib/repository");
      const result = getUserCategoriesForUser(mockDb, "user-1" as UserId);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });

    it("returns empty array when no categories found", async () => {
      mockAll.mockReturnValueOnce([]);

      const { getUserCategoriesForUser } = await import("@/features/categories/lib/repository");
      const result = getUserCategoriesForUser(mockDb, "user-1" as UserId);

      expect(result).toEqual([]);
    });
  });
});
