import { beforeEach, describe, expect, it, vi } from "vitest";
import { startLocalQaSession } from "@/features/qa";

const mockClear = vi.fn(() => Promise.resolve());
const mockSetLocalOnboardingComplete = vi.fn();
const mockOnboardingReset = vi.fn();
const mockResetDbForUser = vi.fn<(userId: string) => Promise<void>>(() => Promise.resolve());
const mockGetDb = vi.fn<(userId: string) => { _: string }>(() => ({ _: "db" }));
const mockMigrate = vi.fn<(db: unknown, config: unknown) => Promise<void>>(() => Promise.resolve());
const mockUpsertFinancialAccount = vi.fn<(db: unknown, row: unknown) => void>();
const mockInsertTransaction = vi.fn<(db: unknown, row: unknown) => void>();
const mockUpsertTransfer = vi.fn<(db: unknown, row: unknown) => void>();
const mockPersistLocalQaSession = vi.fn<(session: unknown) => Promise<void>>(() =>
  Promise.resolve()
);
const mockQueryClientClear = vi.fn();

const session = {
  userId: "qa-local-transfer-ready" as never,
  profile: "transfer-ready" as const,
  onboardingComplete: true,
  displayName: "Local QA Transfer Ready",
  email: "local-qa+transfer-ready@fidy.dev",
};

const seed = {
  session,
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

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: (db: unknown, row: unknown) => mockInsertTransaction(db, row),
}));

vi.mock("@/features/transfers/lib/repository", () => ({
  upsertTransfer: (db: unknown, row: unknown) => mockUpsertTransfer(db, row),
}));

vi.mock("@/shared/query/client", () => ({
  queryClient: {
    clear: () => mockQueryClientClear(),
  },
}));

vi.mock("@/features/qa/lib/build-local-qa-seed", () => ({
  buildLocalQaSeed: (profile: string, now: Date) => mockBuildLocalQaSeed(profile, now),
}));

vi.mock("@/features/qa/local-session", async () => {
  const actual = await vi.importActual<typeof import("@/features/qa/local-session")>(
    "@/features/qa/local-session"
  );

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
    expect(mockResetDbForUser).toHaveBeenCalledWith("qa-local-transfer-ready");
    expect(mockGetDb).toHaveBeenCalledWith("qa-local-transfer-ready");
    expect(mockMigrate).toHaveBeenCalledOnce();
    expect(mockUpsertFinancialAccount).toHaveBeenCalledTimes(1);
    expect(mockInsertTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpsertTransfer).toHaveBeenCalledTimes(1);
    expect(mockPersistLocalQaSession).toHaveBeenCalledWith(session);
    expect(result).toEqual(session);
  });
});
