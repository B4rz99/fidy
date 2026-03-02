import { beforeEach, describe, expect, it } from "vitest";
import { useTransactionStore } from "@/features/transactions/store";

describe("useTransactionStore", () => {
  beforeEach(() => {
    // Reset store between tests
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

  it("saveTransaction succeeds with valid data", () => {
    const store = useTransactionStore.getState();
    store.setDigits("4520");
    store.setCategoryId("food");
    store.setDescription("Groceries");

    const result = store.saveTransaction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transaction.amountCents).toBe(4520);
      expect(result.transaction.categoryId).toBe("food");
      expect(result.transaction.description).toBe("Groceries");
      expect(result.transaction.type).toBe("expense");
    }

    expect(useTransactionStore.getState().transactions).toHaveLength(1);
  });

  it("saveTransaction fails with zero amount", () => {
    const store = useTransactionStore.getState();
    store.setCategoryId("food");
    // digits is empty → amountCents = 0

    const result = store.saveTransaction();
    expect(result.success).toBe(false);
  });

  it("saveTransaction defaults to 'other' when no category selected", () => {
    const store = useTransactionStore.getState();
    store.setDigits("1000");
    // categoryId is null

    const result = store.saveTransaction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transaction.categoryId).toBe("other");
    }
  });

  it("saveTransaction prepends to transaction list", () => {
    const store = useTransactionStore.getState();
    store.setDigits("100");
    store.setCategoryId("food");
    store.saveTransaction();

    store.setDigits("200");
    store.setCategoryId("bills");
    store.saveTransaction();

    const txs = useTransactionStore.getState().transactions;
    expect(txs).toHaveLength(2);
    expect(txs[0].amountCents).toBe(200);
    expect(txs[1].amountCents).toBe(100);
  });

  it("resetForm clears form but keeps transactions and open state", () => {
    const store = useTransactionStore.getState();
    store.openSheet();
    store.setDigits("4520");
    store.setCategoryId("food");
    store.setStep(2);

    store.setDigits("100");
    store.saveTransaction();

    store.resetForm();
    const state = useTransactionStore.getState();
    expect(state.digits).toBe("");
    expect(state.step).toBe(1);
    expect(state.categoryId).toBeNull();
    // Transactions are preserved — resetForm only clears form state
    expect(state.transactions).toHaveLength(1);
  });
});
