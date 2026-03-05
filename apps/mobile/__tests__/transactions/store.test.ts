import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: vi.fn(),
  getAllTransactions: vi.fn().mockResolvedValue([]),
  softDeleteTransaction: vi.fn(),
  enqueueSync: vi.fn(),
}));

import {
  enqueueSync,
  getAllTransactions,
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
      isOpen: false,
      step: 1,
      type: "expense",
      digits: "",
      categoryId: null,
      description: "",
      date: new Date(),
      transactions: [],
    });
  });

  it("starts closed with default form values", () => {
    const state = useTransactionStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.step).toBe(1);
    expect(state.type).toBe("expense");
    expect(state.digits).toBe("");
    expect(state.categoryId).toBeNull();
    expect(state.description).toBe("");
    expect(state.transactions).toEqual([]);
  });

  it("openSheet resets form and opens", () => {
    const store = useTransactionStore.getState();
    store.setDigits("1234");
    store.setStep(2);
    store.openSheet();

    const state = useTransactionStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.step).toBe(1);
    expect(state.digits).toBe("");
  });

  it("closeSheet resets form and closes", () => {
    const store = useTransactionStore.getState();
    store.openSheet();
    store.setDigits("500");
    store.closeSheet();

    const state = useTransactionStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.digits).toBe("");
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
    store.setCategoryId("bills");
    await store.saveTransaction();

    const txs = useTransactionStore.getState().transactions;
    expect(txs).toHaveLength(2);
    expect(txs[0].amountCents).toBe(200);
    expect(txs[1].amountCents).toBe(100);
  });

  it("resetForm clears form but keeps transactions and open state", async () => {
    const store = useTransactionStore.getState();
    store.openSheet();
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

  it("loadTransactions reads from DB and sets state", async () => {
    vi.mocked(getAllTransactions).mockResolvedValueOnce([
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
      },
    ]);

    await useTransactionStore.getState().loadTransactions();

    const txs = useTransactionStore.getState().transactions;
    expect(txs).toHaveLength(1);
    expect(txs[0].id).toBe("tx-1");
    expect(txs[0].userId).toBe(mockUserId);
    expect(txs[0].date).toBeInstanceOf(Date);
    expect(txs[0].createdAt).toBeInstanceOf(Date);
    expect(txs[0].updatedAt).toBeInstanceOf(Date);
    expect(txs[0].deletedAt).toBeNull();
    expect(getAllTransactions).toHaveBeenCalledWith(mockDb, mockUserId);
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
    expect(softDeleteTransaction).toHaveBeenCalledWith(mockDb, txs[0].id);
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
