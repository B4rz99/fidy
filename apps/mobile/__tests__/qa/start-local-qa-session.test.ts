import { beforeEach, describe, expect, it, vi } from "vitest";
import { startLocalQaSession } from "@/features/qa";
import type * as LocalSession from "@/features/qa/local-session";

const mockClear = vi.fn<(...args: any[]) => any>(() => Promise.resolve());
const mockSetLocalOnboardingComplete = vi.fn<(...args: any[]) => any>();
const mockOnboardingReset = vi.fn<(...args: any[]) => any>();
const mockResetDbForUser = vi.fn<(userId: string) => Promise<void>>(() => Promise.resolve());
const mockDb = { _: "db", transaction: (fn: (tx: unknown) => unknown) => fn(mockDb) };
const mockGetDb = vi.fn<(userId: string) => typeof mockDb>(() => mockDb);
const mockMigrate = vi.fn<(db: unknown, config: unknown) => Promise<void>>(() => Promise.resolve());
const mockUpsertFinancialAccount = vi.fn<(db: unknown, row: unknown) => void>();
const mockInsertBudget = vi.fn<(db: unknown, row: unknown) => void>();
const mockInitializeBudgetSession = vi.fn<(userId: string) => void>();
const mockLoadBudgetsForUser = vi.fn<(db: unknown, userId: string) => Promise<void>>(() =>
  Promise.resolve()
);
const mockInitializeTransactionSession = vi.fn<(userId: string) => void>();
const mockLoadInitialTransactions = vi.fn<(db: unknown, userId: string) => Promise<void>>(() =>
  Promise.resolve()
);
const mockInsertTransaction = vi.fn<(db: unknown, row: unknown) => void>();
const mockUpsertTransfer = vi.fn<(db: unknown, row: unknown) => void>();
const mockPersistLocalQaSession = vi.fn<(session: unknown) => Promise<void>>(() =>
  Promise.resolve()
);
const mockQueryClientClear = vi.fn<(...args: any[]) => any>();
const mockBeginEmailCaptureSession = vi.fn<(userId: string) => void>();
const mockSetNeedsReviewEmailSourceEvents = vi.fn<(events: readonly unknown[]) => void>();
const mockSetDetectedSmsCount = vi.fn<(count: number) => void>();
const mockBuildQaNeedsReviewEmailSourceEvents = vi.fn<(...args: any[]) => readonly unknown[]>(
  () => [{ id: "qa-review-email" }]
);
const mockSeedHomeActivityAttributionReviewRows = vi.fn<(...args: any[]) => void>();

const session = {
  userId: "qa-local-transfer-ready" as never,
  profile: "transfer-ready" as const,
  onboardingComplete: true,
  displayName: "Local QA Transfer Ready",
  email: "local-qa+transfer-ready@fidy.dev",
};

const seed = {
  session,
  budgets: [{ id: "budget-1", userId: session.userId } as never],
  financialAccounts: [{ id: "account-1", userId: session.userId } as never],
  transactions: [{ id: "txn-1", userId: session.userId } as never],
  transfers: [{ id: "transfer-1", userId: session.userId } as never],
};

const mockBuildLocalQaSeed = vi.fn<(profile: string, now: Date) => typeof seed>(() => seed);

vi.mock("@/features/onboarding/lib/check-onboarding", () => ({
  clearOnboardingFromStore: () => mockClear(),
}));

vi.mock("@/features/onboarding/store", () => ({
  useOnboardingStore: {
    getState: () => ({ reset: mockOnboardingReset }),
  },
}));

vi.mock("@/features/onboarding/lib/local-onboarding-state", () => ({
  useLocalOnboardingState: {
    getState: () => ({ setIsComplete: mockSetLocalOnboardingComplete }),
  },
}));

vi.mock("@/shared/db", () => ({
  getDb: (userId: string) => mockGetDb(userId),
  resetDbForUser: (userId: string) => mockResetDbForUser(userId),
}));

vi.mock("drizzle-orm/expo-sqlite/migrator", () => ({
  migrate: (db: unknown, config: unknown) => mockMigrate(db, config),
}));

vi.mock("@/drizzle/migrations", () => ({
  default: {
    journal: { entries: [] },
    migrations: {},
  },
}));

vi.mock("@/features/financial-accounts/lib/repository", () => ({
  upsertFinancialAccount: (db: unknown, row: unknown) => mockUpsertFinancialAccount(db, row),
}));

vi.mock("@/features/budget/public", () => ({
  initializeBudgetSession: (userId: string) => mockInitializeBudgetSession(userId),
  insertBudget: (db: unknown, row: unknown) => mockInsertBudget(db, row),
  loadBudgetsForUser: (db: unknown, userId: string) => mockLoadBudgetsForUser(db, userId),
}));

vi.mock("@/features/transactions/store.public", () => ({
  initializeTransactionSession: (userId: string) => mockInitializeTransactionSession(userId),
  loadInitialTransactions: (db: unknown, userId: string) => mockLoadInitialTransactions(db, userId),
}));

vi.mock("@/infrastructure/local-ledger/transaction-storage", () => ({
  insertTransactionStorageRow: (db: unknown, row: unknown) => mockInsertTransaction(db, row),
}));

vi.mock("@/infrastructure/local-ledger/record-transfer", () => ({
  saveTransferStorageRow: (db: unknown, row: unknown) => mockUpsertTransfer(db, row),
  upsertTransferStorageRow: (db: unknown, row: unknown) => mockUpsertTransfer(db, row),
}));

vi.mock("@/shared/query/client", () => ({
  queryClient: {
    clear: () => mockQueryClientClear(),
  },
}));

vi.mock("@/features/qa/lib/build-local-qa-seed", () => ({
  buildLocalQaSeed: (profile: string, now: Date) => mockBuildLocalQaSeed(profile, now),
}));

vi.mock("@/features/qa/lib/home-activity-review-seed", () => ({
  buildQaNeedsReviewEmailSourceEvents: (...args: any[]) =>
    mockBuildQaNeedsReviewEmailSourceEvents(...args),
  seedHomeActivityAttributionReviewRows: (...args: any[]) =>
    mockSeedHomeActivityAttributionReviewRows(...args),
}));

vi.mock("@/features/email-capture/public", () => ({
  useEmailCaptureStore: {
    getState: () => ({
      beginSession: mockBeginEmailCaptureSession,
      setNeedsReviewEmailSourceEvents: mockSetNeedsReviewEmailSourceEvents,
    }),
  },
}));

vi.mock("@/features/capture-sources/public", () => ({
  useCaptureSourcesStore: {
    getState: () => ({
      setDetectedSmsCount: mockSetDetectedSmsCount,
    }),
  },
}));

vi.mock("@/features/qa/local-session", async () => {
  const actual = await vi.importActual<typeof LocalSession>("@/features/qa/local-session");

  return {
    ...actual,
    persistLocalQaSession: (nextSession: unknown) => mockPersistLocalQaSession(nextSession),
  };
});

describe("startLocalQaSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets the local QA runtime, seeds the scenario, and persists the session", async () => {
    const result = await startLocalQaSession("transfer-ready");

    expect(mockBuildLocalQaSeed).toHaveBeenCalledWith("transfer-ready", expect.any(Date));
    expect(mockClear).toHaveBeenCalledOnce();
    expect(mockSetLocalOnboardingComplete).toHaveBeenCalledWith(false);
    expect(mockOnboardingReset).toHaveBeenCalledOnce();
    expect(mockQueryClientClear).toHaveBeenCalledOnce();
    expect(mockBeginEmailCaptureSession).toHaveBeenCalledWith("qa-local-transfer-ready");
    expect(mockSetDetectedSmsCount).toHaveBeenCalledWith(0);
    expect(mockResetDbForUser).toHaveBeenCalledWith("qa-local-transfer-ready");
    expect(mockGetDb).toHaveBeenCalledWith("qa-local-transfer-ready");
    expect(mockMigrate).toHaveBeenCalledOnce();
    expect(mockUpsertFinancialAccount).toHaveBeenCalledTimes(1);
    expect(mockInsertBudget).toHaveBeenCalledTimes(1);
    expect(mockInsertTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpsertTransfer).toHaveBeenCalledTimes(1);
    expect(mockInitializeTransactionSession).toHaveBeenCalledWith("qa-local-transfer-ready");
    expect(mockInitializeBudgetSession).toHaveBeenCalledWith("qa-local-transfer-ready");
    expect(mockLoadInitialTransactions).toHaveBeenCalledWith(mockDb, "qa-local-transfer-ready");
    expect(mockLoadBudgetsForUser).toHaveBeenCalledWith(mockDb, "qa-local-transfer-ready");
    expect(mockSetNeedsReviewEmailSourceEvents).not.toHaveBeenCalled();
    expect(mockSeedHomeActivityAttributionReviewRows).not.toHaveBeenCalled();
    expect(mockPersistLocalQaSession).toHaveBeenCalledWith(session);
    expect(result).toEqual(session);
  });

  it("loads visible review banner state for the home-activity scenario", async () => {
    await startLocalQaSession("home-activity");

    expect(mockBuildQaNeedsReviewEmailSourceEvents).toHaveBeenCalledWith({
      userId: "qa-local-transfer-ready",
      now: expect.any(Date),
    });
    expect(mockSetNeedsReviewEmailSourceEvents).toHaveBeenCalledWith([{ id: "qa-review-email" }]);
    expect(mockSetDetectedSmsCount).toHaveBeenCalledWith(3);
    expect(mockSeedHomeActivityAttributionReviewRows).toHaveBeenCalledWith({
      db: mockDb,
      userId: "qa-local-transfer-ready",
      transactions: seed.transactions,
      now: expect.any(Date),
    });
  });
});
