// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRun = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);
const mockOnConflictDoUpdate = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockUpdateWhere = vi.fn().mockReturnThis();

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  update: mockUpdate,
} as any;

describe("budget repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
    mockOnConflictDoUpdate.mockReturnValue({ run: mockRun });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, all: mockAll });
    mockWhere.mockReturnValue({ all: mockAll });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ run: mockRun });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  describe("insertBudget", () => {
    it("calls db.insert with the correct row", async () => {
      const { insertBudget } = await import("@/features/budget/lib/repository");

      const row = {
        id: "budget-1",
        userId: "user-1",
        categoryId: "food",
        amount: 50000,
        month: "2026-03",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        deletedAt: null,
      };

      insertBudget(mockDb, row);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(row);
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it("uses onConflictDoUpdate to un-delete a soft-deleted budget", async () => {
      const { insertBudget } = await import("@/features/budget/lib/repository");

      const row = {
        id: "budget-new",
        userId: "user-1",
        categoryId: "food",
        amount: 60000,
        month: "2026-03",
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:00:00.000Z",
        deletedAt: null,
      };

      insertBudget(mockDb, row);

      expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          set: expect.objectContaining({
            id: row.id,
            amount: row.amount,
            deletedAt: null,
          }),
        })
      );
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("getBudgetsForMonth", () => {
    it("filters by userId and month and excludes soft-deleted", async () => {
      const mockRows = [
        {
          id: "budget-1",
          userId: "user-1",
          categoryId: "food",
          amount: 50000,
          month: "2026-03",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          deletedAt: null,
        },
      ];
      mockAll.mockReturnValueOnce(mockRows);

      const { getBudgetsForMonth } = await import("@/features/budget/lib/repository");
      const result = getBudgetsForMonth(mockDb, "user-1", "2026-03");

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });

    it("returns empty array when no budgets found", async () => {
      mockAll.mockReturnValueOnce([]);

      const { getBudgetsForMonth } = await import("@/features/budget/lib/repository");
      const result = getBudgetsForMonth(mockDb, "user-1", "2026-03");

      expect(result).toEqual([]);
    });
  });

  describe("getBudgetById", () => {
    it("returns the row when found", async () => {
      const mockRow = {
        id: "budget-1",
        userId: "user-1",
        categoryId: "food",
        amount: 50000,
        month: "2026-03",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        deletedAt: null,
      };
      mockAll.mockReturnValueOnce([mockRow]);

      const { getBudgetById } = await import("@/features/budget/lib/repository");
      const result = getBudgetById(mockDb, "budget-1");

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockRow);
    });

    it("returns null when not found", async () => {
      mockAll.mockReturnValueOnce([]);

      const { getBudgetById } = await import("@/features/budget/lib/repository");
      const result = getBudgetById(mockDb, "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("updateBudgetAmount", () => {
    it("sets amount and updatedAt", async () => {
      const { updateBudgetAmount } = await import("@/features/budget/lib/repository");

      updateBudgetAmount(mockDb, "budget-1", 75000, "2026-03-15T00:00:00.000Z");

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        amount: 75000,
        updatedAt: "2026-03-15T00:00:00.000Z",
      });
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("softDeleteBudget", () => {
    it("sets deletedAt and updatedAt", async () => {
      const { softDeleteBudget } = await import("@/features/budget/lib/repository");

      softDeleteBudget(mockDb, "budget-1", "2026-03-15T00:00:00.000Z");

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        deletedAt: "2026-03-15T00:00:00.000Z",
        updatedAt: "2026-03-15T00:00:00.000Z",
      });
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("copyBudgetsToMonth", () => {
    it("copies source month budgets to target month with new IDs", async () => {
      const sourceRows = [
        {
          id: "budget-1",
          userId: "user-1",
          categoryId: "food",
          amount: 50000,
          month: "2026-02",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
          deletedAt: null,
        },
        {
          id: "budget-2",
          userId: "user-1",
          categoryId: "transport",
          amount: 20000,
          month: "2026-02",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
          deletedAt: null,
        },
      ];

      // First call: getBudgetsForMonth(source), second call: getBudgetsForMonth(target) → empty
      mockAll.mockReturnValueOnce(sourceRows).mockReturnValueOnce([]);

      const { copyBudgetsToMonth } = await import("@/features/budget/lib/repository");

      let idCounter = 0;
      const generateId = vi.fn(() => `new-budget-${++idCounter}`);
      const now = "2026-03-01T00:00:00.000Z";

      const newIds = copyBudgetsToMonth(mockDb, "user-1", "2026-02", "2026-03", now, generateId);

      expect(newIds).toHaveLength(2);
      expect(newIds).toEqual(["new-budget-1", "new-budget-2"]);
      expect(generateId).toHaveBeenCalledTimes(2);
      // insert called once per copied budget (plus the select)
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it("returns empty array when source month has no budgets", async () => {
      // First call: source → empty; second call: target → empty
      mockAll.mockReturnValueOnce([]).mockReturnValueOnce([]);

      const { copyBudgetsToMonth } = await import("@/features/budget/lib/repository");
      const generateId = vi.fn(() => "new-id");

      const newIds = copyBudgetsToMonth(
        mockDb,
        "user-1",
        "2026-02",
        "2026-03",
        "2026-03-01T00:00:00.000Z",
        generateId
      );

      expect(newIds).toEqual([]);
      expect(generateId).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("excludes soft-deleted budgets from source", async () => {
      // getBudgetsForMonth already filters deleted (via isNull), so only active ones returned
      const activeRows = [
        {
          id: "budget-1",
          userId: "user-1",
          categoryId: "food",
          amount: 50000,
          month: "2026-02",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
          deletedAt: null,
        },
      ];
      // First call: source → activeRows; second call: target → empty
      mockAll.mockReturnValueOnce(activeRows).mockReturnValueOnce([]);

      const { copyBudgetsToMonth } = await import("@/features/budget/lib/repository");
      let counter = 0;
      const generateId = vi.fn(() => `new-${++counter}`);

      const newIds = copyBudgetsToMonth(
        mockDb,
        "user-1",
        "2026-02",
        "2026-03",
        "2026-03-01T00:00:00.000Z",
        generateId
      );

      expect(newIds).toHaveLength(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          month: "2026-03",
          categoryId: "food",
          amount: 50000,
          deletedAt: null,
        })
      );
    });

    it("skips categories that already exist in the target month", async () => {
      const sourceRows = [
        {
          id: "budget-1",
          userId: "user-1",
          categoryId: "food",
          amount: 50000,
          month: "2026-02",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
          deletedAt: null,
        },
        {
          id: "budget-2",
          userId: "user-1",
          categoryId: "transport",
          amount: 20000,
          month: "2026-02",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
          deletedAt: null,
        },
      ];
      const existingTargetRows = [
        {
          id: "budget-existing",
          userId: "user-1",
          categoryId: "food",
          amount: 45000,
          month: "2026-03",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          deletedAt: null,
        },
      ];

      // First call: source → sourceRows; second call: target → existingTargetRows
      mockAll.mockReturnValueOnce(sourceRows).mockReturnValueOnce(existingTargetRows);

      const { copyBudgetsToMonth } = await import("@/features/budget/lib/repository");
      let counter = 0;
      const generateId = vi.fn(() => `new-${++counter}`);

      const newIds = copyBudgetsToMonth(
        mockDb,
        "user-1",
        "2026-02",
        "2026-03",
        "2026-03-01T00:00:00.000Z",
        generateId
      );

      // Only "transport" should be copied; "food" already exists in target
      expect(newIds).toHaveLength(1);
      expect(generateId).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: "transport",
          month: "2026-03",
        })
      );
    });
  });
});
