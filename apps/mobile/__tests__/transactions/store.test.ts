import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCloudLedgerBootstrap,
  createEmptyCloudLedgerCache,
} from "@/features/cloud-ledger/public";
import {
  clearCloudLedgerRuntimeCache,
  resetCloudLedgerRuntimeCaches,
  setCloudLedgerRuntimeCache,
  suspendCloudLedgerRuntimeCacheWrites,
} from "@/features/cloud-ledger/runtime.public";
import {
  CloudLedgerOutboxFailure,
  getCloudLedgerOutbox,
} from "@/features/cloud-ledger/outbox.public";
import {
  enqueueCloudLedgerOptimisticAmend,
  enqueueCloudLedgerOptimisticCreate,
  enqueueCloudLedgerOptimisticDelete,
} from "@/features/cloud-ledger/runtime-mutations.public";
import {
  getDailySpendingAggregate,
  getSpendingByCategoryAggregate,
  getTransactionById,
  getTransactionsPaginated,
} from "@/features/transactions/lib/repository";
import {
  deletePendingCloudLedgerTransactionShadows,
  deleteTransaction,
  getStoredTransactionById,
  initializeTransactionSession,
  invalidateTransactionSession,
  loadInitialTransactions,
  loadNextTransactions,
  loadTransactionAggregates,
  loadTransactionIntoForm,
  persistCloudLedgerRuntimeTransactionShadows,
  refreshTransactions,
  resumeTransactionSession,
  saveCurrentTransaction,
  updateTransactionDirect,
  useTransactionStore,
} from "@/features/transactions/store";
import type { StoredTransaction } from "@/features/transactions/schema";
import type { AnyDb } from "@/shared/db";
import { getSupabase } from "@/shared/db/supabase";
import { financialAccounts, transactions, userCategories } from "@/shared/db/schema";
import { toIsoDate, toIsoDateTime } from "@/shared/lib";
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
const cloudLedgerFlushIfOnline = vi.hoisted(() =>
  vi.fn<(...args: any[]) => any>(() => Promise.resolve())
);
const mockTryGetDb = vi.hoisted(() => vi.fn<(...args: any[]) => any>());

vi.mock("@/features/transactions/lib/repository", () => ({
  getTransactionsPaginated: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getSpendingByCategoryAggregate: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getDailySpendingAggregate: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getRecentTransactions: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getTransactionById: vi.fn<(...args: any[]) => any>().mockReturnValue(null),
}));

vi.mock("@/features/cloud-ledger/outbox.public", async () => {
  const actual = await vi.importActual<typeof import("@/features/cloud-ledger/outbox.public")>(
    "@/features/cloud-ledger/outbox.public"
  );
  return {
    ...actual,
    getCloudLedgerOutbox: vi.fn(() => ({
      clear: vi.fn<(...args: any[]) => any>(),
      enqueue: vi.fn<(...args: any[]) => any>(),
      load: vi.fn<(...args: any[]) => any>().mockResolvedValue([]),
      remove: vi.fn<(...args: any[]) => any>(),
    })),
  };
});

vi.mock("@/features/cloud-ledger/runtime-mutations.public", () => ({
  enqueueCloudLedgerOptimisticAmend: vi.fn<(...args: any[]) => any>((input) => {
    cloudLedgerOutboxCalls.push(input);
    return Promise.resolve({
      didWriteRuntimeCache: true,
      flushIfOnline: cloudLedgerFlushIfOnline,
    });
  }),
  enqueueCloudLedgerOptimisticCreate: vi.fn<(...args: any[]) => any>((input) => {
    cloudLedgerOutboxCalls.push(input);
    return Promise.resolve({
      didWriteRuntimeCache: true,
      flushIfOnline: cloudLedgerFlushIfOnline,
    });
  }),
  enqueueCloudLedgerOptimisticDelete: vi.fn<(...args: any[]) => any>((input) => {
    cloudLedgerOutboxCalls.push(input);
    return Promise.resolve({
      didWriteRuntimeCache: true,
      flushIfOnline: cloudLedgerFlushIfOnline,
    });
  }),
}));

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/shared/db/client", () => ({
  tryGetDb: mockTryGetDb,
}));

const insertedTransactionRows: unknown[] = [];
const insertedFinancialAccountRows: unknown[] = [];
const insertedUserCategoryRows: unknown[] = [];
const financialAccountConflictUpdates: unknown[] = [];
const userCategoryConflictUpdates: unknown[] = [];
const deletedTransactionScopes: unknown[] = [];
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
  insert: (table: unknown) => ({
    values: (row: unknown) => ({
      run: () => {
        recordInsertedRow(table, row);
      },
      onConflictDoNothing: () => ({
        run: () => {
          recordInsertedRow(table, row);
        },
      }),
      onConflictDoUpdate: (config: { readonly set?: unknown }) => ({
        run: () => {
          recordConflictUpdate(table, config.set);
          recordInsertedRow(table, row);
        },
      }),
    }),
  }),
  delete: () => ({
    where: (scope: unknown) => ({
      run: () => {
        deletedTransactionScopes.push(scope);
      },
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        run: () => ({ changes: 1 }),
      }),
    }),
  }),
} as unknown as AnyDb;
const mockUserId = "user-1" as UserId;

function recordInsertedRow(table: unknown, row: unknown) {
  if (table === transactions) {
    insertedTransactionRows.push(row);
  }
  if (table === financialAccounts) {
    insertedFinancialAccountRows.push(row);
  }
  if (table === userCategories) {
    insertedUserCategoryRows.push(row);
  }
}

function recordConflictUpdate(table: unknown, set: unknown) {
  if (table === financialAccounts) {
    financialAccountConflictUpdates.push(set);
  }
  if (table === userCategories) {
    userCategoryConflictUpdates.push(set);
  }
}

function seedCloudLedgerRuntimeWithRemoteReferences(accountType = "cash") {
  setCloudLedgerRuntimeCache(
    mockUserId,
    applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
      cursor: "ledger:12" as LedgerCursor,
      categories: [
        {
          id: "ucat-cloud-remote" as CategoryId,
          name: "Remote custom",
          icon: "receipt",
          color: "#445566",
          updatedAt: "2026-06-20T10:01:00.000Z" as IsoDateTime,
        },
      ],
      financialAccounts: [
        {
          id: "fa-cloud-remote" as FinancialAccountId,
          name: "Remote account",
          type: accountType,
          currency: "COP",
          updatedAt: "2026-06-20T10:00:00.000Z" as IsoDateTime,
        },
      ],
      transactions: [
        {
          id: "txn-cloud-remote-reference" as TransactionId,
          type: "expense",
          amount: 4200 as CopAmount,
          currency: "COP",
          categoryId: "ucat-cloud-remote" as CategoryId,
          accountId: "fa-cloud-remote" as FinancialAccountId,
          description: "Remote refs",
          date: "2026-06-20" as IsoDate,
          updatedAt: "2026-06-20T10:02:00.000Z" as IsoDateTime,
          version: 1,
        },
      ],
      tombstones: [],
    })
  );
}

function expectCloudLedgerRemoteReferencesPersisted() {
  expect(insertedFinancialAccountRows).toEqual([
    expect.objectContaining({
      id: "fa-cloud-remote",
      userId: mockUserId,
      name: "Remote account",
      kind: "cash",
    }),
  ]);
  expect(insertedUserCategoryRows).toEqual([
    expect.objectContaining({
      id: "ucat-cloud-remote",
      userId: mockUserId,
      name: "Remote custom",
      iconName: "receipt",
      colorHex: "#445566",
    }),
  ]);
  expect(insertedTransactionRows).toEqual([
    expect.objectContaining({
      id: "txn-cloud-remote-reference",
      accountId: "fa-cloud-remote",
      categoryId: "ucat-cloud-remote",
    }),
  ]);
}

function expectCloudLedgerReferenceMetadataPreserved() {
  expect(financialAccountConflictUpdates).toEqual([]);
  expect(userCategoryConflictUpdates).toEqual([]);
}

function makeStoredTransaction(overrides: Partial<StoredTransaction> = {}) {
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
    source: string;
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

function seedVisibleTransactionSnapshot(transaction: StoredTransaction) {
  useTransactionStore.setState({
    pages: [transaction],
    offset: 1,
    hasMore: false,
    balance: transaction.amount,
    categorySpending: [{ categoryId: transaction.categoryId, total: transaction.amount }],
    dailySpending: [{ date: toIsoDate(transaction.date), total: transaction.amount }],
  });
}

function mockCloudLedgerOutboxLoadFailure(message: string) {
  vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
    createMockCloudLedgerOutbox(
      vi
        .fn<(...args: any[]) => any>()
        .mockRejectedValue(new CloudLedgerOutboxFailure("invalid_encrypted_outbox", message))
    )
  );
}

function mockCommittedRideRefresh() {
  vi.mocked(getTransactionsPaginated).mockReturnValueOnce([
    makeRow({
      id: "tx-db-refresh-after-outbox-failure" as TransactionId,
      amount: 7300 as CopAmount,
      categoryId: "transport" as CategoryId,
      description: "Committed ride",
      date: "2026-06-24" as IsoDate,
    }),
  ]);
  vi.mocked(getSpendingByCategoryAggregate).mockReturnValueOnce([
    { categoryId: "transport" as CategoryId, total: 7300 as CopAmount },
  ]);
  vi.mocked(getDailySpendingAggregate).mockReturnValueOnce([
    { date: "2026-06-24" as IsoDate, total: 7300 as CopAmount },
  ]);
}

function expectCommittedRideRefreshApplied() {
  expect(useTransactionStore.getState()).toMatchObject({
    pages: [
      expect.objectContaining({
        id: "tx-db-refresh-after-outbox-failure",
        amount: 7300,
        categoryId: "transport",
        description: "Committed ride",
      }),
    ],
    offset: 1,
    balance: 7300,
    categorySpending: [{ categoryId: "transport", total: 7300 }],
    dailySpending: [{ date: "2026-06-24", total: 7300 }],
  });
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
    vi.mocked(getTransactionsPaginated).mockReturnValue([]);
    vi.mocked(getSpendingByCategoryAggregate).mockReturnValue([]);
    vi.mocked(getDailySpendingAggregate).mockReturnValue([]);
    vi.mocked(getTransactionById).mockReturnValue(null);
    vi.mocked(getSupabase).mockReturnValue(createMockSupabase());
    vi.mocked(getCloudLedgerOutbox).mockImplementation(() => createMockCloudLedgerOutbox());
    vi.mocked(enqueueCloudLedgerOptimisticAmend).mockImplementation((input) => {
      cloudLedgerOutboxCalls.push(input);
      return Promise.resolve({
        didWriteRuntimeCache: true,
        flushIfOnline: cloudLedgerFlushIfOnline,
      });
    });
    vi.mocked(enqueueCloudLedgerOptimisticCreate).mockImplementation((input) => {
      cloudLedgerOutboxCalls.push(input);
      return Promise.resolve({
        didWriteRuntimeCache: true,
        flushIfOnline: cloudLedgerFlushIfOnline,
      });
    });
    vi.mocked(enqueueCloudLedgerOptimisticDelete).mockImplementation((input) => {
      cloudLedgerOutboxCalls.push(input);
      return Promise.resolve({
        didWriteRuntimeCache: true,
        flushIfOnline: cloudLedgerFlushIfOnline,
      });
    });
    cloudLedgerFlushIfOnline.mockReset();
    cloudLedgerFlushIfOnline.mockResolvedValue(undefined);
    insertedTransactionRows.length = 0;
    insertedFinancialAccountRows.length = 0;
    insertedUserCategoryRows.length = 0;
    financialAccountConflictUpdates.length = 0;
    userCategoryConflictUpdates.length = 0;
    deletedTransactionScopes.length = 0;
    cloudLedgerOutboxCalls.length = 0;
    canUseSelectedAccount = true;
    mockTryGetDb.mockReturnValue(mockDb);
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
    expect(insertedTransactionRows).toEqual([
      expect.objectContaining({
        id: result.transaction.id,
        amount: 4520,
        categoryId: "food",
        description: "Groceries",
      }),
    ]);
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

  it("keeps local QA manual saves out of the Cloud Ledger outbox", async () => {
    initializeTransactionSession(mockUserId, { enableRemoteEffects: false });
    useTransactionStore.getState().setDefaultAccountId("fa-default-user-1" as FinancialAccountId);
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setDescription("Local QA groceries");

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.transaction).toMatchObject({
      amount: 4520,
      categoryId: "food",
      description: "Local QA groceries",
    });
    expect(insertedTransactionRows).toEqual([
      expect.objectContaining({
        id: result.transaction.id,
        amount: 4520,
        categoryId: "food",
        description: "Local QA groceries",
        source: "manual",
      }),
    ]);
    expect(cloudLedgerOutboxCalls).toEqual([]);
    expect(cloudLedgerFlushIfOnline).not.toHaveBeenCalled();
  });

  it("flushes the encrypted Cloud Ledger outbox after an already-online signed-in create", async () => {
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setDescription("Groceries");

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result.success).toBe(true);
    expect(cloudLedgerOutboxCalls).toHaveLength(1);
    expect(cloudLedgerFlushIfOnline).toHaveBeenCalledTimes(1);
    expect(useTransactionStore.getState().pages[0]).toMatchObject({
      amount: 4520,
      categoryId: "food",
      description: "Groceries",
    });
  });

  it("persists a local ordinary row for Cloud Ledger creates so edit and delete routes can load it", async () => {
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setDescription("Groceries");

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(insertedTransactionRows).toEqual([
      expect.objectContaining({
        id: result.transaction.id,
        userId: mockUserId,
        amount: 4520,
        categoryId: "food",
        accountId: "fa-default-user-1",
        description: "Groceries",
        source: "cloud_ledger",
      }),
    ]);
  });

  it("rejects local-only edits and deletes for pending Cloud Ledger creates", async () => {
    const pendingTransaction = makeStoredTransaction({
      id: "tx-pending-cloud-ledger-edit" as TransactionId,
    });
    vi.mocked(getCloudLedgerOutbox).mockReturnValue(
      createMockCloudLedgerOutbox(
        vi
          .fn<(...args: any[]) => any>()
          .mockResolvedValue([pendingCreateFromStoredTransaction(pendingTransaction)])
      )
    );
    vi.mocked(getTransactionById).mockReturnValue(makeRow({ id: pendingTransaction.id }));

    await expect(deleteTransaction(mockDb, mockUserId, pendingTransaction.id)).rejects.toThrow(
      "cloudLedgerMutationUnsupported"
    );
    await expect(
      updateTransactionDirect({
        db: mockDb,
        userId: mockUserId,
        id: pendingTransaction.id,
        fields: {
          type: "expense",
          digits: "9999",
          categoryId: "food" as CategoryId,
          accountId: "fa-default-user-1" as FinancialAccountId,
          description: "Edited locally",
          date: new Date("2026-03-04T00:00:00.000Z"),
        },
      })
    ).resolves.toEqual({ success: false, error: "cloudLedgerMutationUnsupported" });
  });

  it("rejects local-only edits and deletes for persisted Cloud Ledger shadows after restart", async () => {
    const persistedShadow = makeStoredTransaction({
      id: "tx-persisted-cloud-ledger-shadow" as TransactionId,
      source: "cloud_ledger",
    });
    vi.mocked(getTransactionById).mockReturnValue(
      makeRow({ id: persistedShadow.id, source: "cloud_ledger" })
    );
    vi.mocked(getCloudLedgerOutbox).mockReturnValue(createMockCloudLedgerOutbox());

    await expect(deleteTransaction(mockDb, mockUserId, persistedShadow.id)).rejects.toThrow(
      "cloudLedgerMutationUnsupported"
    );
    await expect(
      updateTransactionDirect({
        db: mockDb,
        userId: mockUserId,
        id: persistedShadow.id,
        fields: {
          type: "expense",
          digits: "9999",
          categoryId: "food" as CategoryId,
          accountId: "fa-default-user-1" as FinancialAccountId,
          description: "Edited locally",
          date: new Date("2026-03-04T00:00:00.000Z"),
        },
      })
    ).resolves.toEqual({ success: false, error: "cloudLedgerMutationUnsupported" });
  });

  it("amends accepted Cloud Ledger transactions through the optimistic Remote API outbox", async () => {
    setCloudLedgerRuntimeCache(
      mockUserId,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: "ledger:12" as LedgerCursor,
        categories: [],
        financialAccounts: [],
        transactions: [
          {
            id: "txn-accepted-cloud-edit" as TransactionId,
            type: "expense",
            amount: 1000 as CopAmount,
            currency: "COP",
            categoryId: "food" as CategoryId,
            accountId: "fa-default-user-1" as FinancialAccountId,
            description: "Lunch",
            date: "2026-03-04" as IsoDate,
            updatedAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
            version: 3,
          },
        ],
        tombstones: [],
      })
    );

    const result = await updateTransactionDirect({
      db: mockDb,
      userId: mockUserId,
      id: "txn-accepted-cloud-edit" as TransactionId,
      fields: {
        type: "expense",
        digits: "9999",
        categoryId: "food" as CategoryId,
        accountId: "fa-default-user-1" as FinancialAccountId,
        description: "Edited remotely",
        date: new Date("2026-03-04T00:00:00.000Z"),
      },
    });

    expect(result.success).toBe(true);
    expect(enqueueCloudLedgerOptimisticAmend).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 3,
        transaction: expect.objectContaining({
          id: "txn-accepted-cloud-edit",
          amount: 9999,
          description: "Edited remotely",
          version: 3,
        }),
      })
    );
    expect(cloudLedgerFlushIfOnline).toHaveBeenCalledTimes(1);
  });

  it("deletes accepted Cloud Ledger transactions through the optimistic Remote API outbox", async () => {
    setCloudLedgerRuntimeCache(
      mockUserId,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: "ledger:12" as LedgerCursor,
        categories: [],
        financialAccounts: [],
        transactions: [
          {
            id: "txn-accepted-cloud-delete" as TransactionId,
            type: "expense",
            amount: 1000 as CopAmount,
            currency: "COP",
            categoryId: "food" as CategoryId,
            accountId: "fa-default-user-1" as FinancialAccountId,
            description: "Lunch",
            date: "2026-03-04" as IsoDate,
            updatedAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
            version: 4,
          },
        ],
        tombstones: [],
      })
    );

    await expect(
      deleteTransaction(mockDb, mockUserId, "txn-accepted-cloud-delete" as TransactionId)
    ).resolves.toBeUndefined();

    expect(enqueueCloudLedgerOptimisticDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 4,
        transactionId: "txn-accepted-cloud-delete",
      })
    );
    expect(cloudLedgerFlushIfOnline).toHaveBeenCalledTimes(1);
  });

  it("allows local deletes for ordinary rows when encrypted Cloud Ledger outbox is unreadable", async () => {
    const localTransaction = makeStoredTransaction({
      id: "tx-local-delete-with-corrupt-outbox" as TransactionId,
    });
    const load = vi
      .fn<(...args: any[]) => any>()
      .mockRejectedValue(new CloudLedgerOutboxFailure("invalid_encrypted_outbox", "corrupt"));
    vi.mocked(getTransactionById).mockReturnValue(makeRow({ id: localTransaction.id }));
    vi.mocked(getCloudLedgerOutbox).mockReturnValue(createMockCloudLedgerOutbox(load));

    await expect(
      deleteTransaction(mockDb, mockUserId, localTransaction.id)
    ).resolves.toBeUndefined();

    expect(load).toHaveBeenCalled();
  });

  it("inserts backdated optimistic Cloud Ledger creates after newer cached transactions", async () => {
    const newerTransaction = makeStoredTransaction({
      id: "tx-newer-visible" as TransactionId,
      date: new Date("2026-06-20T00:00:00.000Z"),
      createdAt: new Date("2026-06-20T10:00:00.000Z"),
      updatedAt: new Date("2026-06-20T10:00:00.000Z"),
    });
    useTransactionStore.setState({
      pages: [newerTransaction],
      offset: 1,
      hasMore: false,
    });
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    const backdatedCalendarDate = new Date(2026, 2, 4);
    useTransactionStore.getState().setDate(backdatedCalendarDate);

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result.success).toBe(true);
    expect(useTransactionStore.getState().pages).toEqual([
      newerTransaction,
      expect.objectContaining({
        amount: 4520,
        categoryId: "food",
        date: backdatedCalendarDate,
      }),
    ]);
    expect(useTransactionStore.getState().offset).toBe(1);
  });

  it("dedupes a backdated optimistic Cloud Ledger create when loading the next page", async () => {
    const newerTransaction = makeStoredTransaction({
      id: "tx-newer-visible" as TransactionId,
      date: new Date("2026-06-20T00:00:00.000Z"),
      createdAt: new Date("2026-06-20T10:00:00.000Z"),
      updatedAt: new Date("2026-06-20T10:00:00.000Z"),
    });
    useTransactionStore.setState({
      pages: [newerTransaction],
      offset: 1,
      hasMore: true,
    });
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    const backdatedCalendarDate = new Date(2026, 2, 4);
    useTransactionStore.getState().setDate(backdatedCalendarDate);

    const result = await saveCurrentTransaction(mockDb, mockUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce([
      makeRow({
        id: result.transaction.id,
        date: toIsoDate(backdatedCalendarDate),
        createdAt: toIsoDateTime(result.transaction.createdAt),
        updatedAt: toIsoDateTime(result.transaction.updatedAt),
        source: "cloud_ledger",
      }),
      makeRow({ id: "tx-committed-next" as TransactionId }),
    ]);

    await loadNextTransactions(mockDb, mockUserId);

    const visibleIds = useTransactionStore.getState().pages.map((transaction) => transaction.id);
    expect(visibleIds.filter((id) => id === result.transaction.id)).toHaveLength(1);
    expect(visibleIds).toContain("tx-committed-next");
    expect(getTransactionsPaginated).toHaveBeenLastCalledWith({
      db: mockDb,
      userId: mockUserId,
      limit: 30,
      offset: 1,
    });
  });

  it("does not ask for an online flush when the optimistic runtime write was stale", async () => {
    vi.mocked(enqueueCloudLedgerOptimisticCreate).mockResolvedValueOnce({
      didWriteRuntimeCache: false,
      flushIfOnline: cloudLedgerFlushIfOnline,
    });
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    const result = await saveCurrentTransaction(mockDb, mockUserId);
    expect(result.success).toBe(true);

    expect(cloudLedgerFlushIfOnline).not.toHaveBeenCalled();
    expect(useTransactionStore.getState().pages).toEqual([]);
  });

  it("rejects new manual saves while the transaction session is invalidated for sign-out", async () => {
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    invalidateTransactionSession();
    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result).toEqual({ success: false, error: "Store not initialized" });
    expect(enqueueCloudLedgerOptimisticCreate).not.toHaveBeenCalled();
    expect(insertedTransactionRows).toEqual([]);
    expect(useTransactionStore.getState().activeUserId).toBeNull();
  });

  it("does not write optimistic runtime cache when manual create enqueue resolves after logout", async () => {
    let resolveCreate!: () => void;
    const createPromise = new Promise<void>((resolve) => {
      resolveCreate = resolve;
    });
    vi.mocked(enqueueCloudLedgerOptimisticCreate).mockImplementationOnce((input) => {
      cloudLedgerOutboxCalls.push(input);
      return createPromise.then(() => ({
        didWriteRuntimeCache: false,
        flushIfOnline: cloudLedgerFlushIfOnline,
      }));
    });
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    const savePromise = saveCurrentTransaction(mockDb, mockUserId);
    await vi.waitFor(() => {
      expect(enqueueCloudLedgerOptimisticCreate).toHaveBeenCalledTimes(1);
    });

    clearCloudLedgerRuntimeCache(mockUserId);
    resolveCreate();
    const result = await savePromise;

    expect(result.success).toBe(true);
    expect(useTransactionStore.getState().pages).toEqual([]);
    expect(cloudLedgerFlushIfOnline).not.toHaveBeenCalled();
  });

  it("does not cache stale manual Cloud Ledger creates in ordinary transaction pages after logout starts", async () => {
    let resolveCreate!: () => void;
    const createPromise = new Promise<void>((resolve) => {
      resolveCreate = resolve;
    });
    vi.mocked(enqueueCloudLedgerOptimisticCreate).mockImplementationOnce((input) => {
      cloudLedgerOutboxCalls.push(input);
      return createPromise.then(() => ({
        didWriteRuntimeCache: false,
        flushIfOnline: cloudLedgerFlushIfOnline,
      }));
    });
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    const savePromise = saveCurrentTransaction(mockDb, mockUserId);
    await vi.waitFor(() => {
      expect(enqueueCloudLedgerOptimisticCreate).toHaveBeenCalledTimes(1);
    });

    suspendCloudLedgerRuntimeCacheWrites(mockUserId);
    resolveCreate();
    const result = await savePromise;

    expect(result.success).toBe(true);
    expect(useTransactionStore.getState().pages).toEqual([]);
  });

  it("does not reject manual create when the best-effort flush callback fails", async () => {
    cloudLedgerFlushIfOnline.mockRejectedValueOnce(new Error("offline"));
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    const result = await saveCurrentTransaction(mockDb, mockUserId);
    expect(result.success).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cloudLedgerFlushIfOnline).toHaveBeenCalledTimes(1);
  });

  it("persists manual Cloud Ledger creates without requiring Local Ledger account usability checks", async () => {
    canUseSelectedAccount = false;
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result).toMatchObject({
      success: true,
      transaction: expect.objectContaining({ amount: 4520, categoryId: "food" }),
    });
    expect(insertedTransactionRows).toEqual([
      expect.objectContaining({ amount: 4520, categoryId: "food" }),
    ]);
    expect(cloudLedgerOutboxCalls).toHaveLength(1);
    expect(getTransactionsPaginated).not.toHaveBeenCalled();
  });

  it("counts newly created local Cloud Ledger shadow rows when loading the next committed page", async () => {
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
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    const result = await saveCurrentTransaction(mockDb, mockUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    vi.mocked(getTransactionsPaginated).mockImplementationOnce(({ limit, offset }) =>
      [
        makeRow({
          id: result.transaction.id,
          createdAt: toIsoDateTime(result.transaction.createdAt),
          updatedAt: toIsoDateTime(result.transaction.updatedAt),
        }),
        ...committedRows,
      ].slice(offset, offset + limit + 1)
    );

    await loadNextTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages.map((transaction) => transaction.id)).toContain(
      "tx-committed-30"
    );
    expect(getTransactionsPaginated).toHaveBeenLastCalledWith({
      db: mockDb,
      userId: mockUserId,
      limit: 30,
      offset: 31,
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
      createdAt: new Date("2026-06-24T10:00:00.000Z"),
      date: new Date(2026, 5, 24),
      source: "cloud_ledger",
      updatedAt: new Date("2026-06-24T10:00:00.000Z"),
    });
    setCloudLedgerRuntimeCache(
      mockUserId,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: "ledger:visible-runtime" as LedgerCursor,
        categories: [],
        financialAccounts: [],
        transactions: [
          {
            id: visibleTransaction.id,
            type: visibleTransaction.type,
            amount: visibleTransaction.amount,
            currency: "COP",
            categoryId: visibleTransaction.categoryId,
            accountId: visibleTransaction.accountId,
            description: visibleTransaction.description,
            date: toIsoDate(visibleTransaction.date),
            updatedAt: toIsoDateTime(visibleTransaction.updatedAt),
            version: 1,
          },
        ],
        tombstones: [],
      })
    );
    seedVisibleTransactionSnapshot(visibleTransaction);
    mockCloudLedgerOutboxLoadFailure("decrypt failed");

    await refreshTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState()).toMatchObject({
      pages: [visibleTransaction],
      offset: 0,
      balance: visibleTransaction.amount,
      categorySpending: [
        { categoryId: visibleTransaction.categoryId, total: visibleTransaction.amount },
      ],
      dailySpending: [
        { date: toIsoDate(visibleTransaction.date), total: visibleTransaction.amount },
      ],
    });
  });

  it("applies committed refresh rows when encrypted outbox restore fails", async () => {
    const staleTransaction = makeStoredTransaction({
      id: "tx-stale-before-outbox-failure" as TransactionId,
      amount: 1000 as CopAmount,
    });
    seedVisibleTransactionSnapshot(staleTransaction);
    mockCommittedRideRefresh();
    mockCloudLedgerOutboxLoadFailure("corrupt");

    await refreshTransactions(mockDb, mockUserId);

    expectCommittedRideRefreshApplied();
  });

  it("loads committed initial transactions when encrypted outbox restore fails", async () => {
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce([makeRow()]);
    vi.mocked(getSpendingByCategoryAggregate).mockReturnValueOnce([
      { categoryId: "food" as CategoryId, total: 1000 as CopAmount },
    ]);
    vi.mocked(getDailySpendingAggregate).mockReturnValueOnce([
      { date: "2026-03-04" as IsoDate, total: 1000 as CopAmount },
    ]);
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
      createMockCloudLedgerOutbox(
        vi
          .fn<(...args: any[]) => any>()
          .mockRejectedValue(
            new CloudLedgerOutboxFailure("invalid_encrypted_outbox", "parse failed")
          )
      )
    );

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

  it("rejects manual saves without a selected category", async () => {
    useTransactionStore.getState().setDigits("1000");

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result).toEqual({ success: false, error: "missingCategory" });
    expect(insertedTransactionRows).toEqual([]);
  });

  it("rejects manual Cloud Ledger saves above the remote integer amount limit", async () => {
    useTransactionStore.getState().setDigits("2147483648");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result).toEqual({ success: false, error: "amountTooLarge" });
    expect(cloudLedgerOutboxCalls).toEqual([]);
    expect(useTransactionStore.getState().pages).toEqual([]);
  });

  it("validates Cloud Ledger manual descriptions after trimming whitespace", async () => {
    const trimmedDescription = "x".repeat(200);
    useTransactionStore.getState().setDigits("4520");
    useTransactionStore.getState().setCategoryId("food" as CategoryId);
    useTransactionStore.getState().setDescription(`${trimmedDescription} `);

    const result = await saveCurrentTransaction(mockDb, mockUserId);

    expect(result.success).toBe(true);
    expect(cloudLedgerOutboxCalls).toEqual([
      expect.objectContaining({
        command: expect.objectContaining({
          transaction: expect.objectContaining({
            description: trimmedDescription,
          }),
        }),
      }),
    ]);
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

  it("does not double-count off-page local Cloud Ledger shadow rows or force them into a full page", async () => {
    const today = new Date();
    const todayIso = toIsoDate(today);
    const shadowTransaction = makeStoredTransaction({
      id: "tx-shadow-off-page" as TransactionId,
      amount: 4520 as CopAmount,
      date: today,
      createdAt: new Date(`${todayIso}T08:00:00.000Z`),
      updatedAt: new Date(`${todayIso}T08:00:00.000Z`),
    });
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce(
      Array.from({ length: 30 }, (_, index) =>
        makeRow({
          id: `tx-visible-${index}` as TransactionId,
          date: todayIso,
          createdAt: `${todayIso}T10:${String(index).padStart(2, "0")}:00.000Z` as IsoDateTime,
          updatedAt: `${todayIso}T10:${String(index).padStart(2, "0")}:00.000Z` as IsoDateTime,
        })
      )
    );
    vi.mocked(getSpendingByCategoryAggregate).mockReturnValueOnce([
      { categoryId: "food" as CategoryId, total: shadowTransaction.amount },
    ]);
    vi.mocked(getDailySpendingAggregate).mockReturnValueOnce([
      { date: todayIso, total: shadowTransaction.amount },
    ]);
    vi.mocked(getTransactionById).mockImplementation((_, id) =>
      id === shadowTransaction.id ? makeRow({ id: shadowTransaction.id, date: todayIso }) : null
    );
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
      createMockCloudLedgerOutbox(
        vi
          .fn<(...args: any[]) => any>()
          .mockResolvedValue([pendingCreateFromStoredTransaction(shadowTransaction)])
      )
    );

    await loadInitialTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState()).toMatchObject({
      balance: 4520,
      categorySpending: [{ categoryId: "food", total: 4520 }],
      dailySpending: [{ date: todayIso, total: 4520 }],
    });
    expect(useTransactionStore.getState().pages.map((transaction) => transaction.id)).not.toContain(
      shadowTransaction.id
    );
  });

  it("does not apply a delayed initial optimistic load after the transaction session is invalidated", async () => {
    const delayedPendingTransaction = makeStoredTransaction({
      id: "tx-delayed-discarded-pending" as TransactionId,
    });
    type PendingCreateChange = ReturnType<typeof pendingCreateFromStoredTransaction>;
    let resolveOutboxLoad!: (changes: readonly PendingCreateChange[]) => void;
    const delayedOutboxLoad = vi.fn<(...args: any[]) => any>(
      () =>
        new Promise<readonly PendingCreateChange[]>((resolve) => {
          resolveOutboxLoad = resolve;
        })
    );
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
      createMockCloudLedgerOutbox(delayedOutboxLoad)
    );

    const loadPromise = loadInitialTransactions(mockDb, mockUserId);
    await vi.waitFor(() => {
      expect(delayedOutboxLoad).toHaveBeenCalledTimes(1);
    });

    invalidateTransactionSession();
    resolveOutboxLoad([pendingCreateFromStoredTransaction(delayedPendingTransaction)]);
    await loadPromise;

    expect(useTransactionStore.getState()).toMatchObject({
      pages: [],
      offset: 0,
      balance: 0,
      categorySpending: [],
      dailySpending: [],
    });
  });

  it("resumes the transaction session after aborted logout without clearing visible state", () => {
    const visibleTransaction = makeStoredTransaction({
      id: "tx-visible-before-aborted-logout" as TransactionId,
    });
    useTransactionStore.setState({
      pages: [visibleTransaction],
      offset: 1,
      hasMore: false,
    });

    invalidateTransactionSession();
    resumeTransactionSession(mockUserId);

    expect(useTransactionStore.getState()).toMatchObject({
      activeUserId: mockUserId,
      pages: [visibleTransaction],
      offset: 1,
      hasMore: false,
    });
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
      date: new Date("2026-03-05T00:00:00.000Z"),
      createdAt: new Date("2026-03-05T10:00:00.000Z"),
      updatedAt: new Date("2026-03-05T10:00:00.000Z"),
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
      "tx-committed-29"
    );
    expect(getTransactionsPaginated).toHaveBeenLastCalledWith({
      db: mockDb,
      userId: mockUserId,
      limit: 30,
      offset: 29,
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
            version: 1,
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

  it("keeps full runtime Cloud Ledger history bounded to the loaded page window", async () => {
    const historyDate = "2026-06-20" as IsoDate;
    const runtimeTransactions = Array.from({ length: 35 }, (_, index) => {
      const minute = String(59 - index).padStart(2, "0");
      return {
        id: `txn-cloud-history-${index}` as TransactionId,
        type: "expense" as const,
        amount: (1000 + index) as CopAmount,
        currency: "COP" as const,
        categoryId: "food" as CategoryId,
        accountId: "fa-default-user-1" as FinancialAccountId,
        description: `Accepted history ${index}`,
        date: historyDate,
        updatedAt: `2026-06-20T10:${minute}:00.000Z` as IsoDateTime,
        version: 1,
      };
    });
    setCloudLedgerRuntimeCache(
      mockUserId,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: "ledger:10" as LedgerCursor,
        categories: [],
        financialAccounts: [],
        transactions: runtimeTransactions,
        tombstones: [],
      })
    );
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce(
      runtimeTransactions.slice(0, 31).map((transaction) =>
        makeRow({
          id: transaction.id,
          amount: transaction.amount,
          date: transaction.date,
          createdAt: transaction.updatedAt,
          updatedAt: transaction.updatedAt,
          source: "cloud_ledger",
        })
      )
    );
    vi.mocked(getTransactionById).mockImplementation((_, transactionId) => {
      const transaction = runtimeTransactions.find((item) => item.id === transactionId);
      return transaction
        ? makeRow({
            id: transaction.id,
            amount: transaction.amount,
            date: transaction.date,
            createdAt: transaction.updatedAt,
            updatedAt: transaction.updatedAt,
            source: "cloud_ledger",
          })
        : null;
    });

    await loadInitialTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages.map((transaction) => transaction.id)).toEqual(
      runtimeTransactions.slice(0, 30).map((transaction) => transaction.id)
    );
    expect(useTransactionStore.getState()).toMatchObject({
      offset: 30,
      hasMore: true,
    });
  });

  it("deduplicates restored pending Cloud Ledger rows already present in runtime aggregates", async () => {
    const restoredPendingTransaction = makeStoredTransaction({
      id: "txn-restored-pending-duplicate" as TransactionId,
      amount: 18_000 as CopAmount,
      date: new Date("2026-06-15T12:00:00.000Z"),
      createdAt: new Date("2026-06-15T12:00:00.000Z"),
      updatedAt: new Date("2026-06-15T12:03:00.000Z"),
    });
    const restoredPendingChange = pendingCreateFromStoredTransaction(restoredPendingTransaction);
    setCloudLedgerRuntimeCache(
      mockUserId,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: "ledger:11" as LedgerCursor,
        categories: [],
        financialAccounts: [],
        transactions: [
          {
            ...restoredPendingChange.transaction,
            updatedAt: restoredPendingChange.createdAt as IsoDateTime,
            version: 1,
          },
        ],
        tombstones: [],
      })
    );
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
      createMockCloudLedgerOutbox(
        vi.fn<(...args: any[]) => any>().mockResolvedValue([restoredPendingChange])
      ) as never
    );
    vi.mocked(getTransactionsPaginated).mockReturnValueOnce(
      Array.from({ length: 30 }, (_, index) =>
        makeRow({
          id: `tx-visible-newer-${index}` as TransactionId,
          amount: (1000 + index) as CopAmount,
          date: "2026-06-20" as IsoDate,
          createdAt: `2026-06-20T10:${String(index).padStart(2, "0")}:00.000Z` as IsoDateTime,
          updatedAt: `2026-06-20T10:${String(index).padStart(2, "0")}:00.000Z` as IsoDateTime,
        })
      )
    );

    await loadInitialTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages.map((transaction) => transaction.id)).not.toContain(
      "txn-restored-pending-duplicate"
    );
    expect(useTransactionStore.getState()).toMatchObject({
      balance: 18_000,
      categorySpending: [{ categoryId: "food", total: 18_000 }],
      dailySpending: [{ date: "2026-06-15", total: 18_000 }],
    });
  });

  it("keeps restored pending Cloud Ledger rows bounded to the loaded page window", async () => {
    const restoredChanges = Array.from({ length: 35 }, (_, index) => {
      const timestamp = `2026-06-20T10:${String(59 - index).padStart(2, "0")}:00.000Z`;
      return pendingCreateFromStoredTransaction(
        makeStoredTransaction({
          id: `txn-restored-window-${index}` as TransactionId,
          amount: (1000 + index) as CopAmount,
          date: new Date(timestamp),
          createdAt: new Date(timestamp),
          updatedAt: new Date(timestamp),
        })
      );
    });
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(
      createMockCloudLedgerOutbox(
        vi.fn<(...args: any[]) => any>().mockResolvedValue(restoredChanges)
      )
    );

    await loadInitialTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages).toHaveLength(30);
    expect(useTransactionStore.getState().pages.map((transaction) => transaction.id)).toEqual(
      restoredChanges.slice(0, 30).map((change) => change.transaction.id)
    );
    expect(useTransactionStore.getState()).toMatchObject({
      offset: 0,
      hasMore: false,
    });
  });

  it("maps uncategorized Cloud Ledger transactions to the ordinary Other category", async () => {
    setCloudLedgerRuntimeCache(
      mockUserId,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: "ledger:9" as LedgerCursor,
        categories: [],
        financialAccounts: [],
        transactions: [
          {
            id: "txn-cloud-uncategorized" as TransactionId,
            type: "expense",
            amount: 4200 as CopAmount,
            currency: "COP",
            categoryId: null,
            accountId: "fa-default-user-1" as FinancialAccountId,
            description: "Remote uncategorized",
            date: "2026-06-12" as IsoDate,
            updatedAt: "2026-06-12T10:00:00.000Z" as IsoDateTime,
            version: 1,
          },
        ],
        tombstones: [],
      })
    );

    await loadInitialTransactions(mockDb, mockUserId);

    expect(useTransactionStore.getState().pages).toEqual([
      expect.objectContaining({
        id: "txn-cloud-uncategorized",
        categoryId: "other",
        source: "cloud_ledger",
      }),
    ]);
  });

  it("removes tombstoned persisted Cloud Ledger shadows when runtime refresh no longer contains them", () => {
    setCloudLedgerRuntimeCache(
      mockUserId,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: "ledger:9" as LedgerCursor,
        categories: [],
        financialAccounts: [],
        transactions: [],
        tombstones: [
          {
            recordType: "transaction",
            recordId: "tx-tombstoned-cloud-ledger-shadow",
            deletedAt: "2026-06-02T10:05:00.000Z" as IsoDateTime,
          },
        ],
      })
    );

    persistCloudLedgerRuntimeTransactionShadows(mockDb, mockUserId);

    expect(deletedTransactionScopes).toHaveLength(1);
    expect(insertedTransactionRows).toEqual([]);
  });

  it("persists Cloud Ledger account and custom category references with transaction shadows", () => {
    seedCloudLedgerRuntimeWithRemoteReferences();

    persistCloudLedgerRuntimeTransactionShadows(mockDb, mockUserId);

    expectCloudLedgerRemoteReferencesPersisted();
  });

  it("normalizes unsupported Cloud Ledger account types before persisting references", () => {
    seedCloudLedgerRuntimeWithRemoteReferences("investment");

    persistCloudLedgerRuntimeTransactionShadows(mockDb, mockUserId);

    expect(insertedFinancialAccountRows).toEqual([
      expect.objectContaining({
        id: "fa-cloud-remote",
        userId: mockUserId,
        name: "Remote account",
        kind: "cash",
      }),
    ]);
    expect(insertedTransactionRows).toEqual([
      expect.objectContaining({
        id: "txn-cloud-remote-reference",
        accountId: "fa-cloud-remote",
        categoryId: "ucat-cloud-remote",
      }),
    ]);
  });

  it("does not overwrite local account or category metadata when Cloud Ledger references conflict", () => {
    seedCloudLedgerRuntimeWithRemoteReferences();

    persistCloudLedgerRuntimeTransactionShadows(mockDb, mockUserId);

    expectCloudLedgerReferenceMetadataPreserved();
  });

  it("deletes local Cloud Ledger shadows for pending outbox creates on discard", async () => {
    const pendingTransaction = makeStoredTransaction({
      id: "tx-pending-cloud-ledger-shadow-discard" as TransactionId,
    });
    const load = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue([pendingCreateFromStoredTransaction(pendingTransaction)]);
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(createMockCloudLedgerOutbox(load) as never);

    await deletePendingCloudLedgerTransactionShadows(mockUserId);

    expect(load).toHaveBeenCalled();
    expect(deletedTransactionScopes).toHaveLength(1);
  });

  it("deletes all local Cloud Ledger shadows when pending outbox cleanup cannot read the outbox", async () => {
    const load = vi
      .fn<(...args: any[]) => any>()
      .mockRejectedValue(new CloudLedgerOutboxFailure("invalid_encrypted_outbox", "corrupt"));
    vi.mocked(getCloudLedgerOutbox).mockReturnValueOnce(createMockCloudLedgerOutbox(load) as never);

    await deletePendingCloudLedgerTransactionShadows(mockUserId);

    expect(load).toHaveBeenCalled();
    expect(deletedTransactionScopes).toHaveLength(1);
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
