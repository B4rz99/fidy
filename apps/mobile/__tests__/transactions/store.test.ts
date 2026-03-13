import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
  enqueueSync: vi.fn(),
  getBalance: vi.fn().mockReturnValue(0),
  getCategorySpending: vi.fn().mockReturnValue([]),
  getDailySpending: vi.fn().mockReturnValue([]),
  getTransactionPage: vi.fn().mockReturnValue([]),
}));

import {
  enqueueSync,
  getBalance,
  getCategorySpending,
  getDailySpending,
  getTransactionPage,
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
      transactions: [],
      cursor: null,
      hasMore: false,
      isLoadingMore: false,
      balanceCents: 0,
      categorySpending: [],
      dailySpending: [],
    });
  });

  it("saveTransaction returns error when store is not initialized", async () => {
    // Reset module-level refs by creating a fresh store state without initStore
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
    expect(state.transactions).toEqual([]);
    expect(state.balanceCents).toBe(0);
    expect(state.categorySpending).toEqual([]);
    expect(state.dailySpending).toEqual([]);
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

    expect(useTransactionStore.getState().transactions).toHaveLength(1);
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

  it("saveTransaction prepends to transaction list", async () => {
    const store = useTransactionStore.getState();
    store.setDigits("100");
    store.setCategoryId("food");
    await store.saveTransaction();

    store.setDigits("200");
    store.setCategoryId("services");
    await store.saveTransaction();

    const txs = useTransactionStore.getState().transactions;
    expect(txs).toHaveLength(2);
    expect(txs[0].amountCents).toBe(200);
    expect(txs[1].amountCents).toBe(100);
  });

  it("saveTransaction refreshes aggregates", async () => {
    vi.mocked(getBalance).mockReturnValue(5000);

    const store = useTransactionStore.getState();
    store.setDigits("100");
    store.setCategoryId("food");
    await store.saveTransaction();

    expect(getBalance).toHaveBeenCalled();
    expect(useTransactionStore.getState().balanceCents).toBe(5000);
  });

  it("resetForm clears form but keeps transactions", async () => {
    const store = useTransactionStore.getState();
    store.setDigits("4520");
    store.setCategoryId("food");
    store.setStep(2);

    store.setDigits("100");
    await store.saveTransaction();

    store.resetForm();
    const state = useTransactionStore.getState();
    expect(state.digits).toBe("");
    expect(state.step).toBe(1);
    expect(state.categoryId).toBeNull();
    expect(state.transactions).toHaveLength(1);
  });

  it("loadTransactions calls loadInitialData which fetches aggregates and first page", async () => {
    vi.mocked(getBalance).mockReturnValue(12000);
    vi.mocked(getCategorySpending).mockReturnValue([{ categoryId: "food", totalCents: 3000 }]);
    vi.mocked(getDailySpending).mockReturnValue([{ date: "2026-03-10", totalCents: 2000 }]);
    vi.mocked(getTransactionPage).mockReturnValue([]);

    await useTransactionStore.getState().loadTransactions();

    expect(getBalance).toHaveBeenCalledWith(mockDb, mockUserId);
    expect(getCategorySpending).toHaveBeenCalled();
    expect(getDailySpending).toHaveBeenCalled();
    expect(getTransactionPage).toHaveBeenCalledWith(mockDb, mockUserId, null, 50);

    const state = useTransactionStore.getState();
    expect(state.balanceCents).toBe(12000);
    expect(state.categorySpending).toEqual([{ categoryId: "food", totalCents: 3000 }]);
    expect(state.dailySpending).toEqual([{ date: "2026-03-10", totalCents: 2000 }]);
    expect(state.hasMore).toBe(false);
  });

  it("loadNextPage appends transactions and advances cursor", () => {
    const fakeTx = {
      id: "tx-50",
      userId: mockUserId,
      type: "expense" as const,
      amountCents: 1000,
      categoryId: "food" as const,
      description: "test",
      date: new Date(2026, 2, 10),
      createdAt: new Date(2026, 2, 10),
      updatedAt: new Date(2026, 2, 10),
      deletedAt: null,
    };

    // Set up state as if first page was loaded with 50 items
    useTransactionStore.setState({
      transactions: [fakeTx],
      cursor: { date: "2026-03-10", createdAt: "2026-03-10T00:00:00.000Z", id: "tx-50" },
      hasMore: true,
      isLoadingMore: false,
    });

    vi.mocked(getTransactionPage).mockReturnValue([
      { ...fakeTx, id: "tx-51" },
    ]);

    useTransactionStore.getState().loadNextPage();

    const state = useTransactionStore.getState();
    expect(state.transactions).toHaveLength(2);
    expect(state.isLoadingMore).toBe(false);
    expect(getTransactionPage).toHaveBeenCalledWith(
      mockDb,
      mockUserId,
      { date: "2026-03-10", createdAt: "2026-03-10T00:00:00.000Z", id: "tx-50" },
      50
    );
  });

  it("loadNextPage does nothing when hasMore is false", () => {
    useTransactionStore.setState({ hasMore: false });
    useTransactionStore.getState().loadNextPage();
    expect(getTransactionPage).not.toHaveBeenCalled();
  });

  it("removeTransaction soft-deletes from DB, enqueues sync, and removes from state", async () => {
    const store = useTransactionStore.getState();
    store.setDigits("100");
    store.setCategoryId("food");
    await store.saveTransaction();

    const txs = useTransactionStore.getState().transactions;
    expect(txs).toHaveLength(1);

    await useTransactionStore.getState().removeTransaction(txs[0].id);

    expect(useTransactionStore.getState().transactions).toHaveLength(0);
    expect(softDeleteTransaction).toHaveBeenCalledWith(mockDb, txs[0].id, expect.any(String));
    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        rowId: txs[0].id,
        operation: "delete",
      })
    );
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
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it("removeTransaction keeps UI state when DB operation fails", async () => {
    const store = useTransactionStore.getState();
    store.setDigits("100");
    store.setCategoryId("food");
    await store.saveTransaction();

    const txs = useTransactionStore.getState().transactions;
    expect(txs).toHaveLength(1);

    vi.mocked(softDeleteTransaction).mockRejectedValueOnce(new Error("db error"));
    await useTransactionStore.getState().removeTransaction(txs[0].id);

    expect(useTransactionStore.getState().transactions).toHaveLength(1);
  });
});
