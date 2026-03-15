import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: vi.fn(),
  getTransactionsPaginated: vi.fn().mockReturnValue([]),
  getBalanceAggregate: vi.fn().mockReturnValue(0),
  getSpendingByCategoryAggregate: vi.fn().mockReturnValue([]),
  getDailySpendingAggregate: vi.fn().mockReturnValue([]),
  getRecentTransactions: vi.fn().mockReturnValue([]),
  getTransactionById: vi.fn().mockReturnValue(null),
  softDeleteTransaction: vi.fn(),
  enqueueSync: vi.fn(),
}));

import {
  enqueueSync,
  getBalanceAggregate,
  getTransactionsPaginated,
  insertTransaction,
  softDeleteTransaction,
} from "@/features/transactions/lib/repository";
import { useTransactionStore } from "@/features/transactions/store";

// biome-ignore lint/suspicious/noExplicitAny: mock db needs flexible typing
const mockDb = {} as any;
const mockUserId = "user-1";

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

      balanceCents: 0,
      categorySpending: [],
      dailySpending: [],
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
    useTransactionStore.getState().setCategoryId("food");
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
    store.setCategoryId("food");
    store.setDescription("Groceries");

    const result = await store.saveTransaction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transaction.amountCents).toBe(4520);
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
        amountCents: 4520,
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
    store.setCategoryId("food");

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
    store.setCategoryId("food");

    await store.saveTransaction();

    // refresh calls getTransactionsPaginated and aggregate functions
    expect(getTransactionsPaginated).toHaveBeenCalled();
    expect(getBalanceAggregate).toHaveBeenCalled();
  });

  it("saveTransaction fails with zero amount", async () => {
    const store = useTransactionStore.getState();
    store.setCategoryId("food");

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
      categoryId: "food",
      step: 2,
      pages: [
        {
          id: "tx-1",
          userId: mockUserId,
          type: "expense",
          amountCents: 100,
          categoryId: "food",
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
        id: "tx-1",
        userId: mockUserId,
        type: "expense",
        amountCents: 1000,
        categoryId: "food",
        description: "Lunch",
        date: "2026-03-04",
        createdAt: "2026-03-04T10:00:00.000Z",
        updatedAt: "2026-03-04T10:00:00.000Z",
        deletedAt: null,
        source: "manual",
      },
    ]);

    await useTransactionStore.getState().loadInitialPage();

    const state = useTransactionStore.getState();
    expect(state.pages).toHaveLength(1);
    expect(state.pages[0].id).toBe("tx-1");
    expect(state.pages[0].date).toBeInstanceOf(Date);
    expect(state.hasMore).toBe(false);
    expect(state.offset).toBe(1);
    expect(getTransactionsPaginated).toHaveBeenCalledWith(mockDb, mockUserId, 30, 0);
  });

  it("loadInitialPage sets hasMore when more rows exist", async () => {
    // Return 31 rows (PAGE_SIZE + 1) to indicate more exist
    const rows = Array.from({ length: 31 }, (_, i) => ({
      id: `tx-${i}`,
      userId: mockUserId,
      type: "expense",
      amountCents: 1000,
      categoryId: "food",
      description: `Item ${i}`,
      date: "2026-03-04",
      createdAt: "2026-03-04T10:00:00.000Z",
      updatedAt: "2026-03-04T10:00:00.000Z",
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
          id: "tx-0",
          userId: mockUserId,
          type: "expense",
          amountCents: 100,
          categoryId: "food",
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
        id: "tx-1",
        userId: mockUserId,
        type: "expense",
        amountCents: 200,
        categoryId: "food",
        description: "Second",
        date: "2026-03-03",
        createdAt: "2026-03-03T10:00:00.000Z",
        updatedAt: "2026-03-03T10:00:00.000Z",
        deletedAt: null,
        source: "manual",
      },
    ]);

    await useTransactionStore.getState().loadNextPage();

    const state = useTransactionStore.getState();
    expect(state.pages).toHaveLength(2);
    expect(state.pages[1].id).toBe("tx-1");
    expect(state.hasMore).toBe(false);
  });

  it("loadNextPage does nothing when hasMore is false", async () => {
    useTransactionStore.setState({ hasMore: false });

    await useTransactionStore.getState().loadNextPage();

    expect(getTransactionsPaginated).not.toHaveBeenCalled();
  });

  it("removeTransaction soft-deletes from DB, enqueues sync, and refreshes", async () => {
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-1",
          userId: mockUserId,
          type: "expense",
          amountCents: 100,
          categoryId: "food",
          description: "Test",
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });

    await useTransactionStore.getState().removeTransaction("tx-1");

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
    vi.mocked(insertTransaction).mockRejectedValueOnce(new Error("disk full"));

    const store = useTransactionStore.getState();
    store.setDigits("500");
    store.setCategoryId("food");

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
          id: "tx-1",
          userId: mockUserId,
          type: "expense",
          amountCents: 100,
          categoryId: "food",
          description: "Test",
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });

    vi.mocked(softDeleteTransaction).mockRejectedValueOnce(new Error("db error"));
    await useTransactionStore.getState().removeTransaction("tx-1");

    expect(useTransactionStore.getState().pages).toHaveLength(1);
  });

  it("addToCache prepends to pages", () => {
    const tx = {
      id: "tx-new",
      userId: mockUserId,
      type: "expense" as const,
      amountCents: 500,
      categoryId: "food" as const,
      description: "New",
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    useTransactionStore.getState().addToCache(tx);

    expect(useTransactionStore.getState().pages[0].id).toBe("tx-new");
  });

  it("removeFromCache filters from pages", () => {
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-1",
          userId: mockUserId,
          type: "expense",
          amountCents: 100,
          categoryId: "food",
          description: "Test",
          date: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });

    useTransactionStore.getState().removeFromCache("tx-1");

    expect(useTransactionStore.getState().pages).toHaveLength(0);
  });
});
