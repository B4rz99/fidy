import NetInfo from "@react-native-community/netinfo";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCloudLedgerBootstrap,
  CloudLedgerOutboxFailure,
  createEmptyCloudLedgerCache,
  flushPendingCloudLedgerChanges,
  getCloudLedgerOutbox,
  resetCloudLedgerRuntimeCaches,
  setCloudLedgerRuntimeCache,
} from "@/features/cloud-ledger/public";
import {
  getDailySpendingAggregate,
  getSpendingByCategoryAggregate,
  getTransactionById,
  getTransactionsPaginated,
} from "@/features/transactions/lib/repository";
import {
  getStoredTransactionById,
  initializeTransactionSession,
  loadInitialTransactions,
  loadNextTransactions,
  loadTransactionAggregates,
  loadTransactionIntoForm,
  refreshTransactions,
  saveCurrentTransaction,
  useTransactionStore,
} from "@/features/transactions/store";
import type { StoredTransaction } from "@/features/transactions/schema";
import type { AnyDb } from "@/shared/db";
import { getSupabase } from "@/shared/db/supabase";
import { toIsoDate } from "@/shared/lib";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  LedgerCursor,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const cloudLedgerOutboxCalls: unknown[] = [];

vi.mock("@/features/transactions/lib/repository", () => ({
  getTransactionsPaginated: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getSpendingByCategoryAggregate: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getDailySpendingAggregate: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getRecentTransactions: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getTransactionById: vi.fn<(...args: any[]) => any>().mockReturnValue(null),
}));

vi.mock("@/features/cloud-ledger/public", async () => {
  const actual = await vi.importActual<typeof import("@/features/cloud-ledger/public")>(
    "@/features/cloud-ledger/public"
  );
  return {
    ...actual,
    createOfflineCloudLedgerTransaction: vi.fn<(...args: any[]) => any>((input) => {
      cloudLedgerOutboxCalls.push(input);
      return Promise.resolve(input.cache);
    }),
    flushPendingCloudLedgerChanges: vi.fn<(...args: any[]) => any>((input) =>
      Promise.resolve(input.cache)
    ),
    getCloudLedgerOutbox: vi.fn(() => ({
      clear: vi.fn<(...args: any[]) => any>(),
      enqueue: vi.fn<(...args: any[]) => any>(),
      load: vi.fn<(...args: any[]) => any>().mockResolvedValue([]),
      remove: vi.fn<(...args: any[]) => any>(),
    })),
  };
});

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: vi.fn<(...args: any[]) => any>(),
}));

const insertedTransactionRows: unknown[] = [];
let canUseSelectedAccount = true;
const mockDb = {
  transaction: vi.fn<(...args: any[]) => any>((fn: (tx: unknown) => unknown) => fn(mockDb)),
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => ({
          all: () => (canUseSelectedAccount ? [{ id: "usable-row" }] : []),
        }),
      }),
    }),
  }),
  insert: () => ({
    values: (row: unknown) => ({
      run: () => {
        insertedTransactionRows.push(row);
      },
    }),
  }),
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
    voidedAt: null,
    accountId: "fa-default-user-1" as FinancialAccountId,
    accountAttributionState: "confirmed" as const,
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
    voidedAt: IsoDateTime | null;
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
    voidedAt: null,
    accountId: "fa-default-user-1" as FinancialAccountId,
    accountAttributionState: "confirmed" as const,
    source: "manual",
    ...overrides,
  };
}

function pendingCreateFromStoredTransaction(transaction: StoredTransaction) {
  return {
    id: "change-refresh-pending",
    kind: "createTransaction",
    commandVersion: 1,
    createdAt: transaction.updatedAt.toISOString(),
    transaction: {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      currency: "COP",
      categoryId: transaction.categoryId,
      accountId: transaction.accountId,
      description: transaction.description || null,
      date: toIsoDate(transaction.date),
    },
  } as const;
}

function createMockCloudLedgerOutbox(
  load = vi.fn<(...args: any[]) => any>().mockResolvedValue([])
) {
  return {
    clear: vi.fn<(...args: any[]) => any>(),
    enqueue: vi.fn<(...args: any[]) => any>(),
    load,
    remove: vi.fn<(...args: any[]) => any>(),
  };
}

function createMockSupabase(): SupabaseClient {
  const supabase = {
    auth: {
      getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
        data: { session: { access_token: "ledger-access-token" } },
        error: null,
      }),
    },
  };
  return supabase as unknown as SupabaseClient;
}

describe("transaction boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as never);
    vi.mocked(getSupabase).mockReturnValue(createMockSupabase());
    vi.mocked(getCloudLedgerOutbox).mockImplementation(() => createMockCloudLedgerOutbox());
    insertedTransactionRows.length = 0;
    cloudLedgerOutboxCalls.length = 0;
    canUseSelectedAccount = true;
    resetCloudLedgerRuntimeCaches();
    initializeTransactionSession(mockUserId);
    useTransactionStore.getState().setDefaultAccountId("fa-default-user-1" as FinancialAccountId);
  });

  it("starts with default form values after session initialization", () => {
    const state = useTransactionStore.getState();
    expect(state.activeUserId).toBe(mockUserId);
    expect(state.step).toBe(1);
    expect(state.type).toBe("expense");
    expect(state.digits).toBe("");
    expect(state.categoryId).toBeNull();
    expect(state.accountId).toBe("fa-default-user-1");
    expect(state.description).toBe("");
    expect(state.pages).toEqual([]);
  });

  it("updates form state through setters and resetForm keeps loaded pages", () => {
    useTransactionStore.getState().setType("income");
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setAccountId("fa-cash-1" as FinancialAccountId);
    useTransactionStore.getState().setDescription("Lunch");
    useTransactionStore.getState().setDate(new Date("2026-06-15T00:00:00.000Z"));
    useTransactionStore.setState({ pages: [makeStoredTransaction()] });

    useTransactionStore.getState().resetForm();

    expect(useTransactionStore.getState()).toMatchObject({
      type: "expense",
      digits: "",
      categoryId: null,
      accountId: "fa-default-user-1",
      description: "",
    });
    expect(useTransactionStore.getState().pages).toHaveLength(1);
  });

  it("applies digits updater functions against the latest draft value", () => {
    useTransactionStore.getState().setDigits("45");
    useTransactionStore.getState().setDigits((currentDigits) => `${currentDigits}20`);

    expect(useTransactionStore.getState().digits).toBe("4520");
  });

  it("saveCurrentTransaction returns store-not-initialized when the active session changed", async () => {
    initializeTransactionSession("user-2" as UserId);

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result).toEqual({ success: false, error: "Store not initialized" });
  });

  it("saves valid transactions and refreshes read models", async () => {
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setDescription("Groceries");

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.transaction.amount).toBe(4520);
    expect(insertedTransactionRows).toEqual([]);
    expect(cloudLedgerOutboxCalls).toEqual([
      expect.objectContaining({
        command: expect.objectContaining({
          transaction: expect.objectContaining({
            amount: 4520,
            categoryId: "food",
            description: "Groceries",
          }),
        }),
      }),
    ]);
    expect(getTransactionsPaginated).not.toHaveBeenCalled();
    expect(getSpendingByCategoryAggregate).not.toHaveBeenCalled();
    expect(useTransactionStore.getState().pages[0]).toMatchObject({
      amount: 4520,
      categoryId: "food",
      description: "Groceries",
    });
  });

  it("flushes the encrypted Cloud Ledger outbox after an already-online signed-in create", async () => {
    const outbox = createMockCloudLedgerOutbox();
    const supabase = createMockSupabase();
    vi.mocked(getCloudLedgerOutbox).mockReturnValue(outbox);
    vi.mocked(getSupabase).mockReturnValue(supabase);
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setDescription("Groceries");

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result.success).toBe(true);
    expect(cloudLedgerOutboxCalls).toHaveLength(1);
    await vi.waitFor(() => {
      expect(flushPendingCloudLedgerChanges).toHaveBeenCalledWith({
        cache: expect.any(Object),
        outbox,
        supabase,
      });
    });
    expect(useTransactionStore.getState().pages[0]).toMatchObject({
      amount: 4520,
      categoryId: "food",
      description: "Groceries",
    });
  });

  it("does not use Local Ledger account writes for manual Cloud Ledger creates", async () => {
    canUseSelectedAccount = false;
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result).toMatchObject({
      success: true,
      transaction: expect.objectContaining({ amount: 4520, categoryId: "food" }),
    });
    expect(insertedTransactionRows).toEqual([]);
    expect(cloudLedgerOutboxCalls).toHaveLength(1);
    expect(getTransactionsPaginated).not.toHaveBeenCalled();
  });

  it("does not count newly created optimistic Cloud Ledger rows when loading the next committed page", async () => {
    const committedPages = Array.from({ length: 30 }, (_, index) =>
      makeStoredTransaction({ id: `tx-committed-${index}` as TransactionId })
    );
    const committedRows = Array.from({ length: 35 }, (_, index) =>
      makeRow({
        id: `tx-committed-${index}` as TransactionId,
        createdAt: `2026-03-04T10:${String(index).padStart(2, "0")}:00.000Z` as IsoDateTime,
        updatedAt: `2026-03-04T10:${String(index).padStart(2, "0")}:00.000Z` as IsoDateTime,
      })
    );
    useTransactionStore.setState({
      pages: committedPages,
      offset: committedPages.length,
      hasMore: true,
    });
    vi.mocked(getTransactionsPaginated).mockImplementationOnce(({ limit, offset }) =>
      committedRows.slice(offset, offset + limit + 1)
    );
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    const result = await saveCurrentTransaction(mockDb, mockUserId);
    expect(result.success).toBe(true);

    await loadNextTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages.map((transaction) => transaction.id)).toContain(
      "tx-committed-30"
    );
    expect(getTransactionsPaginated).toHaveBeenLastCalledWith({
      db: mockDb,
      userId: mockUserId,
      limit: 30,
      offset: 30,
    });
  });

  it("keeps pending Cloud Ledger creates visible when transactions refresh before flush", async () => {
    const loadOutbox = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);
    vi.mocked(getCloudLedgerOutbox).mockReturnValue(createMockCloudLedgerOutbox(loadOutbox));
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setDescription("Groceries");

    const result = await saveCurrentTransaction(mockDb, mockUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    loadOutbox.mockResolvedValue([pendingCreateFromStoredTransaction(result.transaction)]);
    await refreshTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages).toEqual([
      expect.objectContaining({
        id: result.transaction.id,
        amount: 4520,
        categoryId: "food",
        description: "Groceries",
      }),
    ]);
    expect(useTransactionStore.getState()).toMatchObject({
      balance: 4520,
      categorySpending: [{ categoryId: "food", total: 4520 }],
      dailySpending: [{ date: toIsoDate(result.transaction.date), total: 4520 }],
    });
    expect(useTransactionStore.getState().pages[0]).not.toHaveProperty("commitStatus");
    expect(useTransactionStore.getState().pages[0]).not.toHaveProperty("pendingChangeId");
  });

  it("keeps visible transactions when encrypted outbox restore fails during refresh", async () => {
    const visibleTransaction = makeStoredTransaction({
      id: "tx-visible-before-outbox-failure" as TransactionId,
    });
    useTransactionStore.setState({
      pages: [visibleTransaction],
      offset: 1,
      hasMore: false,
      balance: visibleTransaction.amount,
      categorySpending: [
        { categoryId: visibleTransaction.categoryId, total: visibleTransaction.amount },
      ],
      dailySpending: [
        { date: toIsoDate(visibleTransaction.date), total: visibleTransaction.amount },
      ],
    });
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
      createMockCloudLedgerOutbox(
        vi
          .fn<(...args: any[]) => any>()
          .mockRejectedValue(
            new CloudLedgerOutboxFailure("invalid_encrypted_outbox", "decrypt failed")
          )
      )
    );

    await refreshTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState()).toMatchObject({
      pages: [visibleTransaction],
      offset: 1,
      balance: visibleTransaction.amount,
      categorySpending: [
        { categoryId: visibleTransaction.categoryId, total: visibleTransaction.amount },
      ],
      dailySpending: [
        { date: toIsoDate(visibleTransaction.date), total: visibleTransaction.amount },
      ],
    });
  });

  it("rejects initial transaction load when encrypted outbox restore fails", async () => {
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
      createMockCloudLedgerOutbox(
        vi
          .fn<(...args: any[]) => any>()
          .mockRejectedValue(
            new CloudLedgerOutboxFailure("invalid_encrypted_outbox", "parse failed")
          )
      )
    );

    await expect(loadInitialTransactions(mockDb, mockUserId)).rejects.toThrow(
      CloudLedgerOutboxFailure
    );
  });

  it("rejects manual saves without a selected category", async () => {
    useTransactionStore.getState().setDigits("1000");

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result).toEqual({ success: false, error: "missingCategory" });
    expect(insertedTransactionRows).toEqual([]);
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

  it("loads restored optimistic Cloud Ledger transactions into ordinary transaction state", async () => {
    const restoredDate = toIsoDate(new Date());
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
      createMockCloudLedgerOutbox(
        vi.fn<(...args: any[]) => any>().mockResolvedValue([
          {
            id: "change-restored-offline",
            kind: "createTransaction",
            commandVersion: 1,
            createdAt: "2026-06-02T10:03:00.000Z",
            transaction: {
              id: "txn-restored-offline",
              type: "expense",
              amount: 18000,
              currency: "COP",
              categoryId: "food",
              accountId: "fa-default-user-1",
              description: "Restored coffee",
              date: restoredDate,
            },
          },
        ])
      )
    );

    await loadInitialTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages).toEqual([
      expect.objectContaining({
        id: "txn-restored-offline",
        amount: 18000,
        categoryId: "food",
        description: "Restored coffee",
      }),
    ]);
    expect(useTransactionStore.getState()).toMatchObject({
      balance: 18000,
      categorySpending: [{ categoryId: "food", total: 18000 }],
      dailySpending: [{ date: restoredDate, total: 18000 }],
    });
    expect(useTransactionStore.getState().pages[0]).not.toHaveProperty("commitStatus");
    expect(useTransactionStore.getState().pages[0]).not.toHaveProperty("pendingChangeId");
  });

  it("does not count restored optimistic Cloud Ledger rows when loading the next committed page", async () => {
    const committedRows = Array.from({ length: 35 }, (_, index) =>
      makeRow({
        id: `tx-committed-${index}` as TransactionId,
        createdAt: `2026-03-04T10:${String(index).padStart(2, "0")}:00.000Z` as IsoDateTime,
        updatedAt: `2026-03-04T10:${String(index).padStart(2, "0")}:00.000Z` as IsoDateTime,
      })
    );
    const pendingTransaction = makeStoredTransaction({
      id: "tx-pending-cloud-ledger" as TransactionId,
    });
    const loadCommittedPage = ({
      limit,
      offset,
    }: {
      readonly limit: number;
      readonly offset: number;
    }) => committedRows.slice(offset, offset + limit + 1);
    vi.mocked(getTransactionsPaginated)
      .mockImplementationOnce(loadCommittedPage)
      .mockImplementationOnce(loadCommittedPage);
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
      createMockCloudLedgerOutbox(
        vi
          .fn<(...args: any[]) => any>()
          .mockResolvedValue([pendingCreateFromStoredTransaction(pendingTransaction)])
      )
    );

    await loadInitialTransactions(mockDb, mockUserId);
    await loadNextTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages.map((transaction) => transaction.id)).toContain(
      "tx-committed-30"
    );
    expect(getTransactionsPaginated).toHaveBeenLastCalledWith({
      db: mockDb,
      userId: mockUserId,
      limit: 30,
      offset: 30,
    });
  });

  it("loads accepted reconciled Cloud Ledger transactions after pending outbox removal", async () => {
    const acceptedDate = toIsoDate(new Date());
    setCloudLedgerRuntimeCache(
      mockUserId,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: "ledger:8" as LedgerCursor,
        categories: [],
        financialAccounts: [],
        transactions: [
          {
            id: "txn-accepted-cloud" as TransactionId,
            type: "expense",
            amount: 18000 as CopAmount,
            currency: "COP",
            categoryId: "food" as CategoryId,
            accountId: "fa-default-user-1" as FinancialAccountId,
            description: "Accepted coffee",
            date: acceptedDate,
            updatedAt: "2026-06-02T10:04:00.000Z" as IsoDateTime,
          },
        ],
        tombstones: [],
      })
    );

    await loadInitialTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages).toEqual([
      expect.objectContaining({
        id: "txn-accepted-cloud",
        amount: 18000,
        categoryId: "food",
        description: "Accepted coffee",
      }),
    ]);
    expect(useTransactionStore.getState()).toMatchObject({
      balance: 18000,
      categorySpending: [{ categoryId: "food", total: 18000 }],
      dailySpending: [{ date: acceptedDate, total: 18000 }],
    });
    expect(useTransactionStore.getState().pages[0]).not.toHaveProperty("commitStatus");
    expect(useTransactionStore.getState().pages[0]).not.toHaveProperty("pendingChangeId");
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

  it("addToCache updates current month aggregates immediately", () => {
    const today = new Date();
    const todayIso = toIsoDate(today);

    useTransactionStore.setState({
      balance: 2000,
      categorySpending: [{ categoryId: "food" as CategoryId, total: 2000 as CopAmount }],
      dailySpending: [{ date: todayIso, total: 2000 as CopAmount }],
    });

    useTransactionStore.getState().addToCache({
      ...makeStoredTransaction({ id: "tx-today" as TransactionId }),
      amount: 1000 as CopAmount,
      date: today,
    });

    expect(useTransactionStore.getState()).toMatchObject({
      balance: 3000,
      categorySpending: [{ categoryId: "food", total: 3000 }],
      dailySpending: [{ date: todayIso, total: 3000 }],
      dataRevision: 1,
    });
  });
});
