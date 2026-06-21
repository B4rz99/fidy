// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CategoryColorOverrideId,
  CategoryIconOverrideId,
  CategoryId,
  IsoDateTime,
  UserCategoryId,
  UserId,
} from "@/shared/types/branded";

const mockRun = vi.fn<(...args: any[]) => any>();
const mockAll = vi.fn<(...args: any[]) => any>().mockReturnValue([]);
const mockValues = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockOnConflictDoUpdate = vi.fn<(...args: any[]) => any>();
const mockSet = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockInsert = vi.fn<(...args: any[]) => any>(() => ({ values: mockValues }));
const mockUpdate = vi.fn<(...args: any[]) => any>(() => ({ set: mockSet }));
const mockSelect = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockFrom = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockWhere = vi.fn<(...args: any[]) => any>().mockReturnThis();

const mockDb = {
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
} as any;

const loadCategoryRepository = () => import("@/features/categories/lib/repository");
const loadCategoryStorage = () => import("@/infrastructure/local-ledger/category-storage");

describe("user categories repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
    mockValues.mockReturnValue({ run: mockRun });
    mockOnConflictDoUpdate.mockReturnValue({ run: mockRun });
    mockSet.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, all: mockAll });
    mockWhere.mockReturnValue({ all: mockAll, run: mockRun });
    mockInsert.mockReturnValue({ values: mockValues });
    mockUpdate.mockReturnValue({ set: mockSet });
  });

  describe("insertUserCategory", () => {
    it("calls db.insert with the correct row", async () => {
      const { insertUserCategory } = await loadCategoryStorage();

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

      const { getUserCategoriesForUser } = await loadCategoryRepository();
      const result = getUserCategoriesForUser(mockDb, "user-1" as UserId);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });

    it("returns empty array when no categories found", async () => {
      mockAll.mockReturnValueOnce([]);

      const { getUserCategoriesForUser } = await loadCategoryRepository();
      const result = getUserCategoriesForUser(mockDb, "user-1" as UserId);

      expect(result).toEqual([]);
    });
  });

  describe("category icon overrides", () => {
    it("upserts a category emoji override by user and category", async () => {
      mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      const { upsertCategoryIconOverride } = await loadCategoryStorage();
      const row = {
        id: "cio-1" as CategoryIconOverrideId,
        userId: "user-1" as UserId,
        categoryId: "food" as CategoryId,
        emoji: "🥑",
        createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        deletedAt: null,
      };

      upsertCategoryIconOverride(mockDb, row);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(row);
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it("clears active category emoji overrides", async () => {
      const { clearCategoryIconOverride } = await loadCategoryStorage();

      clearCategoryIconOverride(mockDb, {
        userId: "user-1" as UserId,
        categoryId: "food" as CategoryId,
        now: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        deletedAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      expect(mockWhere).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it("loads active emoji overrides for a user", async () => {
      const mockRows = [{ categoryId: "food", emoji: "🥑" }];
      mockAll.mockReturnValueOnce(mockRows);

      const { getCategoryIconOverridesForUser } = await loadCategoryRepository();
      const result = getCategoryIconOverridesForUser(mockDb, "user-1" as UserId);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });
  });

  describe("category color overrides", () => {
    it("upserts a category color override by user and category", async () => {
      mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      const { upsertCategoryColorOverride } = await loadCategoryStorage();
      const row = {
        id: "cco-1" as CategoryColorOverrideId,
        userId: "user-1" as UserId,
        categoryId: "food" as CategoryId,
        colorHex: "#7CB243",
        createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        deletedAt: null,
      };

      upsertCategoryColorOverride(mockDb, row);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(row);
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it("clears active category color overrides", async () => {
      const { clearCategoryColorOverride } = await loadCategoryStorage();

      clearCategoryColorOverride(mockDb, {
        userId: "user-1" as UserId,
        categoryId: "food" as CategoryId,
        now: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        deletedAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      expect(mockWhere).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it("loads active color overrides for a user", async () => {
      const mockRows = [{ categoryId: "food", colorHex: "#7CB243" }];
      mockAll.mockReturnValueOnce(mockRows);

      const { getCategoryColorOverridesForUser } = await loadCategoryRepository();
      const result = getCategoryColorOverridesForUser(mockDb, "user-1" as UserId);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });
  });
});
