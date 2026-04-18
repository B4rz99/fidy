import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDailySpendingAggregate,
  getSpendingByCategoryAggregate,
  getTransactionById,
  getTransactionsPaginated,
  insertTransaction,
  softDeleteTransaction,
} from "@/features/transactions/lib/repository";
import {
  getStoredTransactionById,
  initializeTransactionSession,
  loadInitialTransactions,
  loadNextTransactions,
  loadTransactionAggregates,
  loadTransactionIntoForm,
  refreshTransactions,
  removeTransaction,
  saveCurrentTransaction,
  useTransactionStore,
} from "@/features/transactions/store";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db/enqueue-sync";
import type {
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: vi.fn(),
  getTransactionsPaginated: vi.fn().mockReturnValue([]),
  getSpendingByCategoryAggregate: vi.fn().mockReturnValue([]),
  getDailySpendingAggregate: vi.fn().mockReturnValue([]),
  getRecentTransactions: vi.fn().mockReturnValue([]),
  getTransactionById: vi.fn().mockReturnValue(null),
  softDeleteTransaction: vi.fn(),
  upsertTransaction: vi.fn(),
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: vi.fn(),
}));

const mockDb = {
  transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockDb)),
} as unknown as AnyDb;
const mockUserId = "user-1" as UserId;

function makeStoredTransaction(overrides: Partial<{ id: TransactionId; updatedAt: Date }> = {}) {
  return {
    id: "tx-1" as TransactionId,
    userId: mockUserId,
    type: "expense" as const,
    amount: 1000 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Lunch",
    date: new Date("2026-03-04T00:00:00.000Z"),
    createdAt: new Date("2026-03-04T10:00:00.000Z"),
    updatedAt: new Date("2026-03-04T10:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function makeRow(
  overrides: Partial<{
    id: TransactionId;
    type: "expense" | "income";
    amount: CopAmount;
    categoryId: CategoryId;
    description: string | null;
    date: IsoDate;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
    deletedAt: IsoDateTime | null;
  }> = {}
) {
  return {
    id: "tx-1" as TransactionId,
    userId: mockUserId,
    type: "expense",
    amount: 1000 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Lunch",
    date: "2026-03-04" as IsoDate,
    createdAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    source: "manual",
    ...overrides,
  };
}

describe("transaction boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeTransactionSession(mockUserId);
  });

  it("starts with default form values after session initialization", () => {
    const state = useTransactionStore.getState();
    expect(state.activeUserId).toBe(mockUserId);
    expect(state.step).toBe(1);
    expect(state.type).toBe("expense");
    expect(state.digits).toBe("");
    expect(state.categoryId).toBeNull();
    expect(state.description).toBe("");
    expect(state.pages).toEqual([]);
  });

  it("updates form state through setters and resetForm keeps loaded pages", () => {
    useTransactionStore.getState().setType("income");
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setDescription("Lunch");
    useTransactionStore.getState().setDate(new Date("2026-06-15T00:00:00.000Z"));
    useTransactionStore.setState({ pages: [makeStoredTransaction()] });

    useTransactionStore.getState().resetForm();

    expect(useTransactionStore.getState()).toMatchObject({
      type: "expense",
      digits: "",
      categoryId: null,
      description: "",
    });
    expect(useTransactionStore.getState().pages).toHaveLength(1);
  });

  it("saveCurrentTransaction returns store-not-initialized when the active session changed", async () => {
    initializeTransactionSession("user-2" as UserId);

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result).toEqual({ success: false, error: "Store not initialized" });
  });

  it("saves valid transactions and refreshes read models", async () => {
    vi.mocked(getSpendingByCategoryAggregate).mockReturnValueOnce([
      { categoryId: "food" as CategoryId, total: 4520 as CopAmount },
    ]);
    vi.mocked(getDailySpendingAggregate).mockReturnValueOnce([
      { date: "2026-03-04" as IsoDate, total: 4520 as CopAmount },
    ]);

    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setDescription("Groceries");

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.transaction.amount).toBe(4520);
    expect(insertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        amount: 4520,
        categoryId: "food",
        userId: mockUserId,
        updatedAt: expect.any(String),
      })
    );
    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        operation: "insert",
      })
    );
    expect(getTransactionsPaginated).toHaveBeenCalled();
    expect(getSpendingByCategoryAggregate).toHaveBeenCalled();
  });

  it("defaults to the other category when saving without a selection", async () => {
    useTransactionStore.getState().setDigits("1000");

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.transaction.categoryId).toBe("other");
  });

  it("loads the initial transaction snapshot with aggregates", async () => {
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce([makeRow()]);
    vi.mocked(getSpendingByCategoryAggregate).mockReturnValueOnce([
      { categoryId: "food" as CategoryId, total: 1000 as CopAmount },
    ]);
    vi.mocked(getDailySpendingAggregate).mockReturnValueOnce([
      { date: "2026-03-04" as IsoDate, total: 1000 as CopAmount },
    ]);

    await loadInitialTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState()).toMatchObject({
      offset: 1,
      hasMore: false,
      balance: 1000,
      categorySpending: [{ categoryId: "food", total: 1000 }],
      dailySpending: [{ date: "2026-03-04", total: 1000 }],
    });
    expect(useTransactionStore.getState().pages[0]?.id).toBe("tx-1");
  });

  it("loads the next page when more rows are available", async () => {
    useTransactionStore.setState({
      pages: [makeStoredTransaction({ id: "tx-0" as TransactionId })],
      offset: 1,
      hasMore: true,
    });
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce([
      makeRow({ id: "tx-1" as TransactionId }),
    ]);

    await loadNextTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages).toHaveLength(2);
    expect(useTransactionStore.getState().pages[1]?.id).toBe("tx-1");
    expect(useTransactionStore.getState().hasMore).toBe(false);
  });

  it("refreshTransactions increments dataRevision even when page identity is unchanged", async () => {
    useTransactionStore.setState({
      pages: [makeStoredTransaction()],
      offset: 1,
      hasMore: true,
      dataRevision: 2,
    });
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce([makeRow()]);

    await refreshTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState()).toMatchObject({
      dataRevision: 3,
      offset: 1,
      hasMore: false,
    });
    expect(useTransactionStore.getState().pages[0]?.id).toBe("tx-1");
  });

  it("loadTransactionIntoForm hydrates edit state from the stored row", () => {
    vi.mocked(getTransactionById).mockReturnValueOnce(
      makeRow({
        id: "tx-1" as TransactionId,
        type: "income",
        amount: 235000 as CopAmount,
        description: "Payroll correction",
        date: "2026-04-12" as IsoDate,
      })
    );

    const loaded = loadTransactionIntoForm(mockDb, mockUserId, "tx-1" as TransactionId);

    expect(loaded).toBe(true);
    expect(useTransactionStore.getState()).toMatchObject({
      editingId: "tx-1",
      type: "income",
      digits: "235000",
      categoryId: "food",
      description: "Payroll correction",
    });
  });

  it("loadTransactionIntoForm ignores stale session loads without mutating the current form", () => {
    initializeTransactionSession("user-2" as UserId);
    useTransactionStore.setState({
      editingId: "tx-current" as TransactionId,
      step: 2,
      type: "income",
      digits: "999999",
      categoryId: "transport" as CategoryId,
      description: "Current draft",
      date: new Date("2026-05-01T00:00:00.000Z"),
    });

    const loaded = loadTransactionIntoForm(mockDb, mockUserId, "tx-1" as TransactionId);

    expect(loaded).toBe(false);
    expect(getTransactionById).not.toHaveBeenCalled();
    expect(useTransactionStore.getState()).toMatchObject({
      activeUserId: "user-2",
      editingId: "tx-current",
      step: 2,
      type: "income",
      digits: "999999",
      categoryId: "transport",
      description: "Current draft",
    });
  });

  it("loadTransactionIntoForm resets stale edit state when the row is missing", () => {
    useTransactionStore.setState({
      editingId: "tx-stale" as TransactionId,
      step: 2,
      type: "income",
      digits: "235000",
      categoryId: "food" as CategoryId,
      description: "Stale draft",
      date: new Date("2026-04-12T00:00:00.000Z"),
    });
    vi.mocked(getTransactionById).mockReturnValueOnce(null);

    const loaded = loadTransactionIntoForm(mockDb, mockUserId, "tx-missing" as TransactionId);

    expect(loaded).toBe(false);
    expect(useTransactionStore.getState()).toMatchObject({
      editingId: null,
      step: 1,
      type: "expense",
      digits: "",
      categoryId: null,
      description: "",
    });
  });

  it("getStoredTransactionById returns null when the underlying read throws", () => {
    vi.mocked(getTransactionById).mockImplementationOnce(() => {
      throw new Error("db read failed");
    });

    expect(getStoredTransactionById(mockDb, mockUserId, "tx-1" as TransactionId)).toBeNull();
  });

  it("removeTransaction soft-deletes, enqueues sync, and refreshes", async () => {
    await removeTransaction(mockDb, mockUserId, "tx-1" as TransactionId);

    expect(softDeleteTransaction).toHaveBeenCalledWith(mockDb, "tx-1", expect.any(String));
    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        rowId: "tx-1",
        operation: "delete",
      })
    );
    expect(getTransactionsPaginated).toHaveBeenCalled();
  });

  it("loadTransactionAggregates updates aggregate state without disturbing pages", () => {
    useTransactionStore.setState({ pages: [makeStoredTransaction()] });
    vi.mocked(getSpendingByCategoryAggregate).mockReturnValueOnce([
      { categoryId: "food" as CategoryId, total: 50000 as CopAmount },
      { categoryId: "transport" as CategoryId, total: 30000 as CopAmount },
    ]);

    loadTransactionAggregates(mockDb, mockUserId);

    expect(useTransactionStore.getState().balance).toBe(80000);
    expect(useTransactionStore.getState().pages).toHaveLength(1);
  });

  it("addToCache and removeFromCache maintain page state and dataRevision", () => {
    useTransactionStore
      .getState()
      .addToCache(makeStoredTransaction({ id: "tx-new" as TransactionId }));
    expect(useTransactionStore.getState()).toMatchObject({
      offset: 1,
      dataRevision: 1,
    });
    expect(useTransactionStore.getState().pages[0]?.id).toBe("tx-new");

    useTransactionStore.getState().removeFromCache("tx-new" as TransactionId);
    expect(useTransactionStore.getState()).toMatchObject({
      offset: 0,
      dataRevision: 2,
    });
    expect(useTransactionStore.getState().pages).toHaveLength(0);
  });
});
