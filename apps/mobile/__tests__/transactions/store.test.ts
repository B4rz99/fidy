import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBalanceAggregate,
  getSpendingByCategoryAggregate,
  getTransactionById,
  getTransactionsPaginated,
  insertTransaction,
  softDeleteTransaction,
} from "@/features/transactions/lib/repository";
import { useTransactionStore } from "@/features/transactions/store";
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
  getBalanceAggregate: vi.fn().mockReturnValue(0),
  getSpendingByCategoryAggregate: vi.fn().mockReturnValue([]),
  getDailySpendingAggregate: vi.fn().mockReturnValue([]),
  getRecentTransactions: vi.fn().mockReturnValue([]),
  getTransactionById: vi.fn().mockReturnValue(null),
  softDeleteTransaction: vi.fn(),
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: vi.fn(),
}));

const mockDb = {
  transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockDb)),
} as unknown as AnyDb;
const mockUserId = "user-1" as UserId;

describe("useTransactionStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTransactionStore.getState().initStore(mockDb, mockUserId);
    useTransactionStore.setState({
      step: 1,
      type: "expense",
      digits: "",
      categoryId: null,
      description: "",
      date: new Date(),
      pages: [],
      offset: 0,
      hasMore: true,

      balance: 0,
      categorySpending: [],
      dailySpending: [],
      editingId: null,
    });
  });

  it("saveTransaction returns error when store is not initialized", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing uninitialized store guard
    useTransactionStore.getState().initStore(null as any, null as any);
    const result = await useTransactionStore.getState().saveTransaction();
    expect(result).toEqual({ success: false, error: "Store not initialized" });
  });

  it("starts with default form values", () => {
    const state = useTransactionStore.getState();
    expect(state.step).toBe(1);
    expect(state.type).toBe("expense");
    expect(state.digits).toBe("");
    expect(state.categoryId).toBeNull();
    expect(state.description).toBe("");
    expect(state.pages).toEqual([]);
  });

  it("setType toggles between expense and income", () => {
    const store = useTransactionStore.getState();
    store.setType("income");
    expect(useTransactionStore.getState().type).toBe("income");
    store.setType("expense");
    expect(useTransactionStore.getState().type).toBe("expense");
  });

  it("setDigits updates digit string", () => {
    useTransactionStore.getState().setDigits("4520");
    expect(useTransactionStore.getState().digits).toBe("4520");
  });

  it("setCategoryId updates category", () => {
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    expect(useTransactionStore.getState().categoryId).toBe("food");
  });

  it("setDescription updates description", () => {
    useTransactionStore.getState().setDescription("Lunch");
    expect(useTransactionStore.getState().description).toBe("Lunch");
  });

  it("setDate updates date", () => {
    const newDate = new Date("2026-06-15");
    useTransactionStore.getState().setDate(newDate);
    expect(useTransactionStore.getState().date).toEqual(newDate);
  });

  it("saveTransaction succeeds with valid data and persists to DB", async () => {
    const store = useTransactionStore.getState();
    store.setDigits("4520");
    store.setCategoryId("food" as CategoryId);
    store.setDescription("Groceries");

    const result = await store.saveTransaction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transaction.amount).toBe(4520);
      expect(result.transaction.categoryId).toBe("food");
      expect(result.transaction.description).toBe("Groceries");
      expect(result.transaction.type).toBe("expense");
      expect(result.transaction.userId).toBe(mockUserId);
      expect(result.transaction.updatedAt).toBeInstanceOf(Date);
      expect(result.transaction.deletedAt).toBeNull();
    }

    expect(insertTransaction).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        amount: 4520,
        categoryId: "food",
        type: "expense",
        userId: mockUserId,
        updatedAt: expect.any(String),
      })
    );
  });

  it("saveTransaction enqueues sync entry after insert", async () => {
    const store = useTransactionStore.getState();
    store.setDigits("1000");
    store.setCategoryId("food" as CategoryId);

    await store.saveTransaction();

    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        operation: "insert",
      })
    );
  });

  it("saveTransaction calls refresh after successful save", async () => {
    const store = useTransactionStore.getState();
    store.setDigits("1000");
    store.setCategoryId("food" as CategoryId);

    await store.saveTransaction();

    // refresh calls getTransactionsPaginated and aggregate functions
    expect(getTransactionsPaginated).toHaveBeenCalled();
    expect(getSpendingByCategoryAggregate).toHaveBeenCalled();
  });

  it("saveTransaction fails with zero amount", async () => {
    const store = useTransactionStore.getState();
    store.setCategoryId("food" as CategoryId);

    const result = await store.saveTransaction();
    expect(result.success).toBe(false);
    expect(insertTransaction).not.toHaveBeenCalled();
  });

  it("saveTransaction defaults to 'other' when no category selected", async () => {
    const store = useTransactionStore.getState();
    store.setDigits("1000");

    const result = await store.saveTransaction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transaction.categoryId).toBe("other");
    }
  });

  it("resetForm clears form but keeps pages", async () => {
    useTransactionStore.setState({
      digits: "4520",
      categoryId: "food" as CategoryId,
      step: 2,
      pages: [
        {
          id: "tx-1" as TransactionId,
          userId: mockUserId,
          type: "expense",
          amount: 100 as CopAmount,
          categoryId: "food" as CategoryId,
          description: "Test",
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });

    useTransactionStore.getState().resetForm();
    const state = useTransactionStore.getState();
    expect(state.digits).toBe("");
    expect(state.step).toBe(1);
    expect(state.categoryId).toBeNull();
    expect(state.pages).toHaveLength(1);
  });

  it("loadInitialPage reads paginated data from DB", async () => {
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce([
      {
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
      },
    ]);

    await useTransactionStore.getState().loadInitialPage();

    const state = useTransactionStore.getState();
    expect(state.pages).toHaveLength(1);
    expect(state.pages[0]?.id).toBe("tx-1");
    expect(state.pages[0]?.date).toBeInstanceOf(Date);
    expect(state.hasMore).toBe(false);
    expect(state.offset).toBe(1);
    expect(getTransactionsPaginated).toHaveBeenCalledWith(mockDb, mockUserId, 30, 0);
  });

  it("loadInitialPage sets hasMore when more rows exist", async () => {
    // Return 31 rows (PAGE_SIZE + 1) to indicate more exist
    const rows = Array.from({ length: 31 }, (_, i) => ({
      id: `tx-${i}` as TransactionId,
      userId: mockUserId,
      type: "expense",
      amount: 1000 as CopAmount,
      categoryId: "food" as CategoryId,
      description: `Item ${i}`,
      date: "2026-03-04" as IsoDate,
      createdAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
      deletedAt: null,
      source: "manual",
    }));
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce(rows);

    await useTransactionStore.getState().loadInitialPage();

    const state = useTransactionStore.getState();
    expect(state.pages).toHaveLength(30);
    expect(state.hasMore).toBe(true);
    expect(state.offset).toBe(30);
  });

  it("loadNextPage appends more transactions", async () => {
    // Set up initial state with first page loaded
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-0" as TransactionId,
          userId: mockUserId,
          type: "expense",
          amount: 100 as CopAmount,
          categoryId: "food" as CategoryId,
          description: "First",
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
      offset: 1,
      hasMore: true,
    });

    vi.mocked(getTransactionsPaginated).mockReturnValueOnce([
      {
        id: "tx-1" as TransactionId,
        userId: mockUserId,
        type: "expense",
        amount: 200 as CopAmount,
        categoryId: "food" as CategoryId,
        description: "Second",
        date: "2026-03-03" as IsoDate,
        createdAt: "2026-03-03T10:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-03T10:00:00.000Z" as IsoDateTime,
        deletedAt: null,
        source: "manual",
      },
    ]);

    await useTransactionStore.getState().loadNextPage();

    const state = useTransactionStore.getState();
    expect(state.pages).toHaveLength(2);
    expect(state.pages[1]?.id).toBe("tx-1");
    expect(state.hasMore).toBe(false);
  });

  it("loadNextPage does nothing when hasMore is false", async () => {
    useTransactionStore.setState({ hasMore: false });

    await useTransactionStore.getState().loadNextPage();

    expect(getTransactionsPaginated).not.toHaveBeenCalled();
  });

  it("refresh updates pagination metadata even when transaction rows are unchanged", async () => {
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-1" as TransactionId,
          userId: mockUserId,
          type: "expense",
          amount: 1000 as CopAmount,
          categoryId: "food" as CategoryId,
          description: "Lunch",
          date: new Date("2026-03-04T00:00:00.000Z"),
          createdAt: new Date("2026-03-04T10:00:00.000Z"),
          updatedAt: new Date("2026-03-04T10:00:00.000Z"),
          deletedAt: null,
        },
      ],
      offset: 1,
      hasMore: true,
    });

    vi.mocked(getTransactionsPaginated).mockReturnValueOnce([
      {
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
      },
    ]);

    await useTransactionStore.getState().refresh();

    expect(useTransactionStore.getState().hasMore).toBe(false);
  });

  it("refresh keeps existing pages and aggregates when the DB read fails", async () => {
    const existingDate = new Date("2026-03-04T00:00:00.000Z");
    const existingUpdatedAt = new Date("2026-03-04T10:00:00.000Z");
    const existingCategorySpending = [
      { categoryId: "food" as CategoryId, total: 42000 as CopAmount },
    ];
    const existingDailySpending = [{ date: "2026-03-04" as IsoDate, total: 42000 as CopAmount }];

    useTransactionStore.setState({
      pages: [
        {
          id: "tx-1" as TransactionId,
          userId: mockUserId,
          type: "expense",
          amount: 42000 as CopAmount,
          categoryId: "food" as CategoryId,
          description: "Existing lunch",
          date: existingDate,
          createdAt: existingUpdatedAt,
          updatedAt: existingUpdatedAt,
          deletedAt: null,
        },
      ],
      offset: 1,
      hasMore: true,
      balance: 42000,
      categorySpending: existingCategorySpending,
      dailySpending: existingDailySpending,
    });

    vi.mocked(getTransactionsPaginated).mockImplementationOnce(() => {
      throw new Error("db read failed");
    });

    await useTransactionStore.getState().refresh();

    const state = useTransactionStore.getState();
    expect(state.pages).toHaveLength(1);
    expect(state.pages[0]?.id).toBe("tx-1");
    expect(state.offset).toBe(1);
    expect(state.hasMore).toBe(true);
    expect(state.balance).toBe(42000);
    expect(state.categorySpending).toEqual(existingCategorySpending);
    expect(state.dailySpending).toEqual(existingDailySpending);
    expect(getSpendingByCategoryAggregate).not.toHaveBeenCalled();
  });

  it("editTransaction hydrates edit mode from the stored transaction row", () => {
    vi.mocked(getTransactionById).mockReturnValueOnce({
      id: "tx-1" as TransactionId,
      userId: mockUserId,
      type: "income",
      amount: 235000 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Payroll correction",
      date: "2026-04-12" as IsoDate,
      createdAt: "2026-04-12T08:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-04-13T09:00:00.000Z" as IsoDateTime,
      deletedAt: null,
      source: "manual",
    });

    useTransactionStore.getState().editTransaction("tx-1" as TransactionId);

    const state = useTransactionStore.getState();
    expect(state.editingId).toBe("tx-1");
    expect(state.type).toBe("income");
    expect(state.digits).toBe("235000");
    expect(state.categoryId).toBe("food");
    expect(state.description).toBe("Payroll correction");
    expect(state.date.getFullYear()).toBe(2026);
    expect(state.date.getMonth()).toBe(3);
    expect(state.date.getDate()).toBe(12);
  });

  it("editTransaction clears stale edit state when the requested row is missing", () => {
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

    useTransactionStore.getState().editTransaction("tx-missing" as TransactionId);

    const state = useTransactionStore.getState();
    expect(state.editingId).toBeNull();
    expect(state.step).toBe(1);
    expect(state.type).toBe("expense");
    expect(state.digits).toBe("");
    expect(state.categoryId).toBeNull();
    expect(state.description).toBe("");
  });

  it("editTransaction clears stale edit state when the DB read throws", () => {
    useTransactionStore.setState({
      editingId: "tx-stale" as TransactionId,
      step: 2,
      type: "income",
      digits: "235000",
      categoryId: "food" as CategoryId,
      description: "Stale draft",
      date: new Date("2026-04-12T00:00:00.000Z"),
    });

    vi.mocked(getTransactionById).mockImplementationOnce(() => {
      throw new Error("db read failed");
    });

    expect(() =>
      useTransactionStore.getState().editTransaction("tx-broken" as TransactionId)
    ).not.toThrow();

    const state = useTransactionStore.getState();
    expect(state.editingId).toBeNull();
    expect(state.step).toBe(1);
    expect(state.type).toBe("expense");
    expect(state.digits).toBe("");
    expect(state.categoryId).toBeNull();
    expect(state.description).toBe("");
  });

  it("getTransactionById returns null when the DB read throws", () => {
    vi.mocked(getTransactionById).mockImplementationOnce(() => {
      throw new Error("db read failed");
    });

    const result = useTransactionStore.getState().getTransactionById("tx-1" as TransactionId);

    expect(result).toBeNull();
  });

  it("removeTransaction soft-deletes from DB, enqueues sync, and refreshes", async () => {
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-1" as TransactionId,
          userId: mockUserId,
          type: "expense",
          amount: 100 as CopAmount,
          categoryId: "food" as CategoryId,
          description: "Test",
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });

    await useTransactionStore.getState().removeTransaction("tx-1" as TransactionId);

    expect(softDeleteTransaction).toHaveBeenCalledWith(mockDb, "tx-1", expect.any(String));
    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        rowId: "tx-1",
        operation: "delete",
      })
    );
    // refresh was called
    expect(getTransactionsPaginated).toHaveBeenCalled();
  });

  it("saveTransaction returns error when DB insert fails", async () => {
    vi.mocked(insertTransaction).mockImplementationOnce(() => {
      throw new Error("disk full");
    });

    const store = useTransactionStore.getState();
    store.setDigits("500");
    store.setCategoryId("food" as CategoryId);

    const result = await store.saveTransaction();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Failed to save transaction");
    }
  });

  it("removeTransaction keeps UI state when DB operation fails", async () => {
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-1" as TransactionId,
          userId: mockUserId,
          type: "expense",
          amount: 100 as CopAmount,
          categoryId: "food" as CategoryId,
          description: "Test",
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });

    vi.mocked(softDeleteTransaction).mockImplementationOnce(() => {
      throw new Error("db error");
    });
    await expect(
      useTransactionStore.getState().removeTransaction("tx-1" as TransactionId)
    ).rejects.toThrow("db error");

    expect(useTransactionStore.getState().pages).toHaveLength(1);
  });

  it("addToCache prepends to pages", () => {
    const tx = {
      id: "tx-new" as TransactionId,
      userId: mockUserId,
      type: "expense" as const,
      amount: 500 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "New",
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    useTransactionStore.getState().addToCache(tx);

    expect(useTransactionStore.getState().pages[0]?.id).toBe("tx-new");
  });

  it("removeFromCache filters from pages", () => {
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-1" as TransactionId,
          userId: mockUserId,
          type: "expense",
          amount: 100 as CopAmount,
          categoryId: "food" as CategoryId,
          description: "Test",
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });

    useTransactionStore.getState().removeFromCache("tx-1" as TransactionId);

    expect(useTransactionStore.getState().pages).toHaveLength(0);
  });

  it("loadAggregates derives balance from current month category spending totals", () => {
    vi.mocked(getSpendingByCategoryAggregate).mockReturnValueOnce([
      { categoryId: "food" as CategoryId, total: 50000 as CopAmount },
      { categoryId: "transport" as CategoryId, total: 30000 as CopAmount },
    ]);

    useTransactionStore.getState().loadAggregates();

    const state = useTransactionStore.getState();
    expect(state.balance).toBe(80000);
    expect(getBalanceAggregate).not.toHaveBeenCalled();
  });
});
