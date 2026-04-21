// biome-ignore-all lint/suspicious/noExplicitAny: sync conflict state tests use flexible mock db
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadSyncConflicts,
  resolveSyncConflictSelection,
  useSyncConflictStore,
} from "@/features/sync/store";
import { createParsedConflict } from "./fixtures";

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
    mockListConflicts.mockResolvedValueOnce([createParsedConflict()]);

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
