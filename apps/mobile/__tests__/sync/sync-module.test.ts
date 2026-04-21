// biome-ignore-all lint/suspicious/noExplicitAny: sync boundary test uses flexible mock ports
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createConflictRow } from "./fixtures";

const mockGetSupabase = vi.fn();
const mockIsOnline = vi.fn();
const mockSyncPull = vi.fn();
const mockSyncPush = vi.fn();
const mockGetUnresolvedConflicts = vi.fn();
const mockRefreshTransactions = vi.fn();
const mockUpsertTransaction = vi.fn();

vi.mock("@/features/transactions/store", () => ({
  refreshTransactions: (...args: any[]) => mockRefreshTransactions(...args),
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  upsertTransaction: (...args: any[]) => mockUpsertTransaction(...args),
}));

vi.mock("@/shared/effect/network", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/effect/network")>();
  return {
    ...actual,
    liveAppNetwork: {
      isOnline: (...args: any[]) => mockIsOnline(...args),
    },
  };
});

vi.mock("@/shared/effect/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/effect/supabase")>();
  return {
    ...actual,
    liveAppSupabase: {
      getSupabase: (...args: any[]) => mockGetSupabase(...args),
    },
  };
});

vi.mock("@/features/sync/services/syncEngine", () => ({
  syncPull: (...args: any[]) => mockSyncPull(...args),
  syncPush: (...args: any[]) => mockSyncPush(...args),
}));

vi.mock("@/features/sync/lib/conflict-repository", () => ({
  getUnresolvedConflicts: (...args: any[]) => mockGetUnresolvedConflicts(...args),
}));

describe("sync module", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetSupabase.mockReturnValue({ from: vi.fn() });
    mockIsOnline.mockResolvedValue(true);
    mockSyncPull.mockResolvedValue(true);
    mockSyncPush.mockResolvedValue(undefined);
    mockGetUnresolvedConflicts.mockReturnValue([]);
    mockRefreshTransactions.mockResolvedValue(undefined);
    mockUpsertTransaction.mockReset();
  });

  it("syncs by pulling first, then pushing queued rows when online", async () => {
    const { sync } = await import("@/features/sync/services/sync");
    const db = {} as any;

    const result = await sync({ db, userId: "user-1", reason: "foreground" });

    expect(mockIsOnline).toHaveBeenCalled();
    expect(mockSyncPull).toHaveBeenCalledWith(db, expect.any(Object), "user-1");
    expect(mockSyncPush).toHaveBeenCalledWith(db, expect.any(Object), "user-1");
    expect(mockRefreshTransactions).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("synced");
    expect(result.unresolvedConflicts).toBe(0);
  });

  it("returns skipped_offline without touching remote sync when offline", async () => {
    mockIsOnline.mockResolvedValue(false);
    const { sync } = await import("@/features/sync/services/sync");
    const db = {} as any;

    const result = await sync({ db, userId: "user-1" });

    expect(mockSyncPull).not.toHaveBeenCalled();
    expect(mockSyncPush).not.toHaveBeenCalled();
    expect(mockRefreshTransactions).not.toHaveBeenCalled();
    expect(result.status).toBe("skipped_offline");
  });

  it("lists unresolved conflicts through the boundary", async () => {
    mockGetUnresolvedConflicts.mockReturnValueOnce([createConflictRow()]);

    const { listConflicts } = await import("@/features/sync/services/sync");
    const conflicts = await listConflicts({ db: {} as any });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.transactionId).toBe("tx-1");
    expect(conflicts[0]?.localData.amount).toBe(1000);
  });
});
