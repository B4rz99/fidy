// biome-ignore-all lint/suspicious/noExplicitAny: sync boundary test uses flexible mock ports
import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();
const mockGetSupabase = vi.fn();
const mockIsOnline = vi.fn();
const mockSyncPull = vi.fn();
const mockSyncPush = vi.fn();
const mockGetUnresolvedConflicts = vi.fn();

vi.mock("@/shared/db", () => ({
  getSupabase: (...args: any[]) => mockGetSupabase(...args),
}));

vi.mock("@/features/transactions", () => ({
  useTransactionStore: {
    getState: () => ({
      refresh: refreshMock,
    }),
  },
}));

vi.mock("@/features/sync/services/networkMonitor", () => ({
  isOnline: (...args: any[]) => mockIsOnline(...args),
}));

vi.mock("@/features/sync/services/syncEngine", () => ({
  syncPull: (...args: any[]) => mockSyncPull(...args),
  syncPush: (...args: any[]) => mockSyncPush(...args),
}));

vi.mock("@/features/sync/lib/conflict-repository", () => ({
  getUnresolvedConflicts: (...args: any[]) => mockGetUnresolvedConflicts(...args),
}));

describe("sync module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabase.mockReturnValue({ from: vi.fn() });
    mockIsOnline.mockResolvedValue(true);
    mockSyncPull.mockResolvedValue(true);
    mockSyncPush.mockResolvedValue(undefined);
    mockGetUnresolvedConflicts.mockReturnValue([]);
  });

  it("syncs by pulling first, then pushing queued rows when online", async () => {
    const { sync } = await import("@/features/sync/services/sync");
    const db = {} as any;

    const result = await sync({ db, userId: "user-1", reason: "foreground" });

    expect(mockIsOnline).toHaveBeenCalled();
    expect(mockSyncPull).toHaveBeenCalledWith(db, expect.any(Object), "user-1");
    expect(mockSyncPush).toHaveBeenCalledWith(db, expect.any(Object), "user-1");
    expect(refreshMock).toHaveBeenCalledTimes(1);
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
    expect(refreshMock).not.toHaveBeenCalled();
    expect(result.status).toBe("skipped_offline");
  });

  it("lists unresolved conflicts through the boundary", async () => {
    mockGetUnresolvedConflicts.mockReturnValueOnce([
      {
        id: "conflict-1",
        transactionId: "tx-1",
        localData: JSON.stringify({
          id: "tx-1",
          userId: "user-1",
          type: "expense",
          amount: 1000,
          categoryId: "food",
          description: "Local merchant",
          date: "2026-03-10",
          createdAt: "2026-03-10T08:00:00.000Z",
          updatedAt: "2026-03-10T10:00:00.000Z",
          deletedAt: null,
          source: "manual",
        }),
        serverData: JSON.stringify({
          id: "tx-1",
          userId: "user-1",
          type: "expense",
          amount: 2000,
          categoryId: "food",
          description: "Server merchant",
          date: "2026-03-10",
          createdAt: "2026-03-10T08:00:00.000Z",
          updatedAt: "2026-03-10T14:00:00.000Z",
          deletedAt: null,
          source: "email",
        }),
        detectedAt: "2026-03-15T10:00:00.000Z",
      },
    ]);

    const { listConflicts } = await import("@/features/sync/services/sync");
    const conflicts = await listConflicts({ db: {} as any });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.transactionId).toBe("tx-1");
    expect(conflicts[0]?.localData.amount).toBe(1000);
  });
});
