// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BudgetId,
  CategoryId,
  CopAmount,
  IsoDateTime,
  Month,
  UserId,
} from "@/shared/types/branded";

type BudgetRow = {
  id: BudgetId;
  userId: UserId;
  categoryId: CategoryId;
  amount: CopAmount;
  month: Month;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};

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

const USER_ID = "user-1" as UserId;
const SOURCE_MONTH = "2026-02" as Month;
const TARGET_MONTH = "2026-03" as Month;
const COPY_NOW = "2026-03-01T00:00:00.000Z" as IsoDateTime;

function makeBudgetRow(overrides: Partial<BudgetRow> = {}): BudgetRow {
  return {
    id: "budget-1" as BudgetId,
    userId: USER_ID,
    categoryId: "food" as CategoryId,
    amount: 50000 as CopAmount,
    month: TARGET_MONTH,
    createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    ...overrides,
  };
}

async function loadBudgetRepository() {
  return import("@/features/budget/lib/repository");
}

function mockCopySourceAndTarget(sourceRows: BudgetRow[], targetRows: BudgetRow[] = []) {
  mockAll.mockReturnValueOnce(sourceRows).mockReturnValueOnce(targetRows);
}

async function runCopyBudgets(generateId: () => BudgetId) {
  const { copyBudgetsToMonth } = await loadBudgetRepository();
  return copyBudgetsToMonth(mockDb, USER_ID, SOURCE_MONTH, TARGET_MONTH, COPY_NOW, generateId);
}

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
      const { insertBudget } = await loadBudgetRepository();
      const row = makeBudgetRow();

      insertBudget(mockDb, row);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(row);
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it("uses onConflictDoUpdate to un-delete a soft-deleted budget", async () => {
      const { insertBudget } = await loadBudgetRepository();
      const row = makeBudgetRow({
        id: "budget-new" as BudgetId,
        amount: 60000 as CopAmount,
        createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
      });

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
      const mockRows = [makeBudgetRow()];
      mockAll.mockReturnValueOnce(mockRows);

      const { getBudgetsForMonth } = await loadBudgetRepository();
      const result = getBudgetsForMonth(mockDb, USER_ID, TARGET_MONTH);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });

    it("returns empty array when no budgets found", async () => {
      mockAll.mockReturnValueOnce([]);

      const { getBudgetsForMonth } = await loadBudgetRepository();
      const result = getBudgetsForMonth(mockDb, USER_ID, TARGET_MONTH);

      expect(result).toEqual([]);
    });
  });

  describe("getBudgetById", () => {
    it("returns the row when found", async () => {
      const mockRow = makeBudgetRow();
      mockAll.mockReturnValueOnce([mockRow]);

      const { getBudgetById } = await loadBudgetRepository();
      const result = getBudgetById(mockDb, "budget-1" as BudgetId);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockRow);
    });

    it("returns null when not found", async () => {
      mockAll.mockReturnValueOnce([]);

      const { getBudgetById } = await loadBudgetRepository();
      const result = getBudgetById(mockDb, "nonexistent" as BudgetId);

      expect(result).toBeNull();
    });
  });

  describe("updateBudgetAmount", () => {
    it("sets amount and updatedAt", async () => {
      const { updateBudgetAmount } = await loadBudgetRepository();

      updateBudgetAmount(
        mockDb,
        "budget-1" as BudgetId,
        75000 as CopAmount,
        "2026-03-15T00:00:00.000Z" as IsoDateTime
      );

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
      const { softDeleteBudget } = await loadBudgetRepository();

      softDeleteBudget(mockDb, "budget-1" as BudgetId, "2026-03-15T00:00:00.000Z" as IsoDateTime);

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
      mockCopySourceAndTarget([
        makeBudgetRow({ month: SOURCE_MONTH }),
        makeBudgetRow({
          id: "budget-2" as BudgetId,
          categoryId: "transport" as CategoryId,
          amount: 20000 as CopAmount,
          month: SOURCE_MONTH,
        }),
      ]);

      let idCounter = 0;
      const generateId = vi.fn(() => `new-budget-${++idCounter}` as BudgetId);
      const newIds = await runCopyBudgets(generateId);

      expect(newIds).toEqual(["new-budget-1", "new-budget-2"]);
      expect(generateId).toHaveBeenCalledTimes(2);
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it("returns empty array when source month has no budgets", async () => {
      mockCopySourceAndTarget([]);

      const generateId = vi.fn(() => "new-id" as BudgetId);
      const newIds = await runCopyBudgets(generateId);

      expect(newIds).toEqual([]);
      expect(generateId).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("excludes soft-deleted budgets from source", async () => {
      mockCopySourceAndTarget([makeBudgetRow({ month: SOURCE_MONTH })]);

      let counter = 0;
      const generateId = vi.fn(() => `new-${++counter}` as BudgetId);
      const newIds = await runCopyBudgets(generateId);

      expect(newIds).toHaveLength(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          month: TARGET_MONTH,
          categoryId: "food",
          amount: 50000,
          deletedAt: null,
        })
      );
    });

    it("skips categories that already exist in the target month", async () => {
      mockCopySourceAndTarget(
        [
          makeBudgetRow({ month: SOURCE_MONTH }),
          makeBudgetRow({
            id: "budget-2" as BudgetId,
            categoryId: "transport" as CategoryId,
            amount: 20000 as CopAmount,
            month: SOURCE_MONTH,
          }),
        ],
        [makeBudgetRow({ id: "budget-existing" as BudgetId, amount: 45000 as CopAmount })]
      );

      let counter = 0;
      const generateId = vi.fn(() => `new-${++counter}` as BudgetId);
      const newIds = await runCopyBudgets(generateId);

      expect(newIds).toHaveLength(1);
      expect(generateId).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: "transport",
          month: TARGET_MONTH,
        })
      );
    });
  });
});
