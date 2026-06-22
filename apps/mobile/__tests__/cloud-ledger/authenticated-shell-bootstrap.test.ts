import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAuthenticatedBootstrap } from "@/bootstrap/authenticated-shell";
import { useTransactionStore } from "@/features/transactions/store.public";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const mocks = vi.hoisted(() => {
  const acceptedTransaction = {
    id: "txn-accepted-restart",
    type: "expense",
    amount: 18000,
    currency: "COP",
    categoryId: "food",
    accountId: "fa-default-user-1",
    description: "Accepted restart coffee",
    date: "2026-06-20",
    updatedAt: "2026-06-20T10:04:00.000Z",
  };
  const createEmptyCache = () => ({
    cursor: null,
    categories: [],
    financialAccounts: [],
    transactions: [],
    transactionProjection: {
      incomeTotal: 0,
      expenseTotal: 0,
      categorySpending: [],
      dailySpending: [],
    },
  });
  const state = { runtimeCache: createEmptyCache() };
  const noopTask = (id: string) => ({
    id,
    run: vi.fn<(...args: any[]) => any>(),
  });
  const noopSubscriptionTask = (id: string) => ({
    id,
    subscribe: vi.fn<(...args: any[]) => any>(),
  });

  return {
    acceptedTransaction,
    createEmptyCache,
    state,
    noopTask,
    noopSubscriptionTask,
    flushPendingCloudLedgerChanges: vi.fn<(...args: any[]) => any>(),
    getCloudLedgerOutbox: vi.fn<(...args: any[]) => any>(),
    getCloudLedgerRuntimeCache: vi.fn<(...args: any[]) => any>(() => state.runtimeCache),
    getSupabase: vi.fn<(...args: any[]) => any>(),
    restoreOptimisticCloudLedgerCache: vi.fn<(...args: any[]) => any>(),
    setCloudLedgerRuntimeCache: vi.fn<(...args: any[]) => any>((_userId, cache) => {
      state.runtimeCache = cache;
    }),
    tryEnsureDefaultFinancialAccount: vi.fn<(...args: any[]) => any>(),
  };
});

vi.mock("@/features/ai-chat/bootstrap", () => ({
  aiChatBootstrapTask: mocks.noopTask("ai-chat"),
}));

vi.mock("@/features/analytics/bootstrap", () => ({
  analyticsBootstrapTask: mocks.noopTask("analytics"),
  analyticsTransactionSubscriptionTask: mocks.noopSubscriptionTask("analytics-transaction"),
}));

vi.mock("@/features/background-fetch/bootstrap", () => ({
  backgroundFetchBootstrapTask: mocks.noopTask("background-fetch"),
}));

vi.mock("@/features/budget/bootstrap", () => ({
  budgetBootstrapTask: mocks.noopTask("budget"),
  budgetTransactionSubscriptionTask: mocks.noopSubscriptionTask("budget-transaction"),
}));

vi.mock("@/features/calendar/bootstrap", () => ({
  calendarBootstrapTask: mocks.noopTask("calendar"),
}));

vi.mock("@/features/capture-sources/bootstrap", () => ({
  captureSourcesBootstrapTask: mocks.noopTask("capture-sources"),
  useCaptureSourcesBootstrap: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/features/categories/bootstrap", () => ({
  categoriesBootstrapTask: mocks.noopTask("categories"),
}));

vi.mock("@/features/email-capture/bootstrap", () => ({
  emailCaptureMaintenanceBootstrapTask: mocks.noopTask("email-capture-maintenance"),
  useEmailCaptureBootstrap: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/features/goals/bootstrap", () => ({
  goalsBootstrapTask: mocks.noopTask("goals"),
  goalsTransactionSubscriptionTask: mocks.noopSubscriptionTask("goals-transaction"),
}));

vi.mock("@/features/notifications/bootstrap", () => ({
  notificationsBootstrapTask: mocks.noopTask("notifications"),
  useNotificationBootstrap: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/features/settings/bootstrap", () => ({
  settingsBootstrapTask: mocks.noopTask("settings"),
}));

vi.mock("@/features/financial-accounts/public", () => ({
  tryEnsureDefaultFinancialAccount: mocks.tryEnsureDefaultFinancialAccount,
}));

vi.mock("@/features/cloud-ledger/public", () => ({
  flushPendingCloudLedgerChanges: mocks.flushPendingCloudLedgerChanges,
  getCloudLedgerOutbox: mocks.getCloudLedgerOutbox,
  getCloudLedgerRuntimeCache: mocks.getCloudLedgerRuntimeCache,
  restoreOptimisticCloudLedgerCache: mocks.restoreOptimisticCloudLedgerCache,
  setCloudLedgerRuntimeCache: mocks.setCloudLedgerRuntimeCache,
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  getTransactionsPaginated: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getSpendingByCategoryAggregate: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getDailySpendingAggregate: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getRecentTransactions: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getTransactionById: vi.fn<(...args: any[]) => any>().mockReturnValue(null),
}));

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

describe("authenticated shell Cloud Ledger bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.runtimeCache = mocks.createEmptyCache();
    mocks.getCloudLedgerOutbox.mockReturnValue({
      clear: vi.fn<(...args: any[]) => any>(),
      enqueue: vi.fn<(...args: any[]) => any>(),
      load: vi.fn<(...args: any[]) => any>().mockResolvedValue([]),
      remove: vi.fn<(...args: any[]) => any>(),
    });
    mocks.getSupabase.mockReturnValue({ functions: { invoke: vi.fn<(...args: any[]) => any>() } });
    mocks.restoreOptimisticCloudLedgerCache.mockImplementation(async ({ cache }) => cache);
    mocks.flushPendingCloudLedgerChanges.mockImplementation(async ({ cache }) => ({
      ...cache,
      transactions: [mocks.acceptedTransaction],
    }));
    mocks.tryEnsureDefaultFinancialAccount.mockReturnValue({ id: "fa-default-user-1" });
  });

  it("makes accepted Cloud Ledger transactions visible on the first ordinary load after restart", async () => {
    await runAuthenticatedBootstrap({
      db: {} as never,
      enableRemoteEffects: true,
      userId: "user-1" as UserId,
    });
    await Promise.resolve();

    expect(useTransactionStore.getState().pages).toEqual([
      expect.objectContaining({
        id: "txn-accepted-restart" as TransactionId,
        amount: 18000 as CopAmount,
        categoryId: "food" as CategoryId,
        accountId: "fa-default-user-1" as FinancialAccountId,
        description: "Accepted restart coffee",
      }),
    ]);
    expect(useTransactionStore.getState().pages[0]).not.toHaveProperty("commitStatus");
    expect(useTransactionStore.getState().pages[0]).not.toHaveProperty("pendingChangeId");
  });
});
