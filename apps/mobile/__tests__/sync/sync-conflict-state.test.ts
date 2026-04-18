// biome-ignore-all lint/suspicious/noExplicitAny: sync conflict state tests use flexible mock db
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadSyncConflicts,
  resolveSyncConflictSelection,
  useSyncConflictStore,
} from "@/features/sync/store";

const mockListConflicts = vi.fn();
const mockResolveConflict = vi.fn();

vi.mock("@/features/sync/services/sync", () => ({
  listConflicts: (...args: any[]) => mockListConflicts(...args),
  resolveConflict: (...args: any[]) => mockResolveConflict(...args),
}));

describe("sync conflict state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSyncConflictStore.setState({ conflicts: [], conflictCount: 0 });
  });

  it("loads conflicts into the store from the sync boundary", async () => {
    mockListConflicts.mockResolvedValueOnce([
      {
        id: "conflict-1",
        transactionId: "tx-1",
        localData: {
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
        },
        serverData: {
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
        },
        detectedAt: "2026-03-15T10:00:00.000Z",
      },
    ]);

    await loadSyncConflicts({} as any);

    expect(mockListConflicts).toHaveBeenCalledWith({ db: {} });
    expect(useSyncConflictStore.getState().conflictCount).toBe(1);
    expect(useSyncConflictStore.getState().conflicts[0]?.id).toBe("conflict-1");
  });

  it("resolves a conflict through the boundary and reloads store state", async () => {
    mockResolveConflict.mockResolvedValueOnce({ unresolvedConflicts: 0 });
    mockListConflicts.mockResolvedValueOnce([]);

    await resolveSyncConflictSelection({} as any, "conflict-1", "local");

    expect(mockResolveConflict).toHaveBeenCalledWith({
      db: {},
      conflictId: "conflict-1",
      resolution: "local",
    });
    expect(mockListConflicts).toHaveBeenCalledWith({ db: {} });
    expect(useSyncConflictStore.getState().conflicts).toEqual([]);
    expect(useSyncConflictStore.getState().conflictCount).toBe(0);
  });
});
