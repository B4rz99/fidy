import { describe, expect, it, vi } from "vitest";
import { createSyncService } from "@/features/sync/services/create-sync-service";
import { requireIsoDateTime } from "@/shared/types/assertions";
import { createConflictRow } from "./fixtures";

const TEST_DB = {} as never;
const TEST_USER_ID = "user-1";

const createSyncPorts = (overrides: Record<string, unknown> = {}) => ({
  network: { isOnline: vi.fn().mockResolvedValue(true) },
  supabase: { getSupabase: vi.fn() },
  syncPull: vi.fn(),
  syncPush: vi.fn(),
  refreshTransactions: vi.fn(),
  getConflictRows: vi.fn().mockResolvedValue([]),
  upsertTransaction: vi.fn(),
  enqueueTransactionSync: vi.fn(),
  resolveConflictRow: vi.fn(),
  ...overrides,
});

const createService = (overrides: Record<string, unknown> = {}) => {
  const ports = createSyncPorts(overrides);
  return { service: createSyncService(ports), ports };
};

describe("createSyncService", () => {
  it("returns skipped_offline and does not touch remote sync when offline", async () => {
    const { service, ports } = createService({
      network: { isOnline: vi.fn().mockResolvedValue(false) },
      getConflictRows: vi.fn().mockResolvedValue([createConflictRow()]),
    });

    const result = await service.run({
      db: TEST_DB,
      userId: TEST_USER_ID,
      reason: "foreground",
    });

    expect(result).toEqual({
      status: "skipped_offline",
      unresolvedConflicts: 1,
    });
    expect(ports.supabase.getSupabase).not.toHaveBeenCalled();
    expect(ports.syncPull).not.toHaveBeenCalled();
    expect(ports.syncPush).not.toHaveBeenCalled();
    expect(ports.refreshTransactions).not.toHaveBeenCalled();
  });

  it("maps unresolved conflict rows into sync conflict records", async () => {
    const { service } = createService({
      getConflictRows: vi.fn().mockResolvedValue([createConflictRow()]),
    });

    const conflicts = await service.listConflicts({ db: TEST_DB });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toEqual({
      id: "conflict-1",
      transactionId: "tx-1",
      localData: expect.objectContaining({ amount: 1000, source: "manual" }),
      serverData: expect.objectContaining({ amount: 2000, source: "email" }),
      detectedAt: "2026-03-15T10:00:00.000Z",
    });
  });

  it("re-enqueues the local transaction when resolving a conflict in favor of local data", async () => {
    const resolvedAt = requireIsoDateTime("2026-04-18T12:34:56.000Z");
    const { service, ports } = createService({
      refreshTransactions: vi.fn(),
      getConflictRows: vi
        .fn()
        .mockResolvedValueOnce([createConflictRow()])
        .mockResolvedValueOnce([]),
      upsertTransaction: vi.fn(),
      enqueueTransactionSync: vi.fn(),
      resolveConflictRow: vi.fn(),
      clock: {
        now: () => new Date(resolvedAt),
        nowIsoDateTime: () => resolvedAt,
      },
    });

    const result = await service.resolveConflict({
      db: TEST_DB,
      conflictId: "conflict-1" as never,
      resolution: "local",
    });

    expect(ports.upsertTransaction).toHaveBeenCalledWith(
      TEST_DB,
      expect.objectContaining({
        id: "tx-1",
        amount: 1000,
        source: "manual",
        updatedAt: resolvedAt,
      })
    );
    expect(ports.enqueueTransactionSync).toHaveBeenCalledWith(TEST_DB, "tx-1", resolvedAt);
    expect(ports.resolveConflictRow).toHaveBeenCalledWith(
      TEST_DB,
      "conflict-1",
      "local",
      resolvedAt
    );
    expect(ports.refreshTransactions).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ unresolvedConflicts: 0 });
  });

  it("still resolves server conflicts when localData is malformed", async () => {
    const { service, ports } = createService({
      refreshTransactions: vi.fn(),
      getConflictRows: vi
        .fn()
        .mockResolvedValueOnce([createConflictRow({ localData: "{not-json" as never })])
        .mockResolvedValueOnce([]),
      upsertTransaction: vi.fn(),
      enqueueTransactionSync: vi.fn(),
      resolveConflictRow: vi.fn(),
    });

    const result = await service.resolveConflict({
      db: TEST_DB,
      conflictId: "conflict-1" as never,
      resolution: "server",
    });

    expect(ports.upsertTransaction).not.toHaveBeenCalled();
    expect(ports.enqueueTransactionSync).not.toHaveBeenCalled();
    expect(ports.resolveConflictRow).toHaveBeenCalledWith(
      TEST_DB,
      "conflict-1",
      "server",
      expect.any(String)
    );
    expect(ports.refreshTransactions).toHaveBeenCalledWith({ db: TEST_DB, userId: TEST_USER_ID });
    expect(result).toEqual({ unresolvedConflicts: 0 });
  });
});
