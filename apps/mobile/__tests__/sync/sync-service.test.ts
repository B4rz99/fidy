import { describe, expect, it, vi } from "vitest";

import { createSyncService } from "@/features/sync/services/create-sync-service";
import { requireIsoDateTime } from "@/shared/types/assertions";

describe("createSyncService", () => {
  it("returns skipped_offline and does not touch remote sync when offline", async () => {
    const isOnline = vi.fn().mockResolvedValue(false);
    const getSupabase = vi.fn();
    const syncPull = vi.fn();
    const syncPush = vi.fn();
    const refreshTransactions = vi.fn();
    const getConflictRows = vi.fn().mockResolvedValue([
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

    const service = createSyncService({
      syncPull,
      syncPush,
      refreshTransactions,
      getConflictRows,
      upsertTransaction: vi.fn(),
      enqueueTransactionSync: vi.fn(),
      resolveConflictRow: vi.fn(),
      network: { isOnline },
      supabase: { getSupabase },
    });

    const result = await service.run({
      db: {} as never,
      userId: "user-1",
      reason: "foreground",
    });

    expect(result).toEqual({
      status: "skipped_offline",
      unresolvedConflicts: 1,
    });
    expect(getSupabase).not.toHaveBeenCalled();
    expect(syncPull).not.toHaveBeenCalled();
    expect(syncPush).not.toHaveBeenCalled();
    expect(refreshTransactions).not.toHaveBeenCalled();
  });

  it("maps unresolved conflict rows into sync conflict records", async () => {
    const service = createSyncService({
      network: { isOnline: vi.fn().mockResolvedValue(true) },
      supabase: { getSupabase: vi.fn() },
      syncPull: vi.fn(),
      syncPush: vi.fn(),
      refreshTransactions: vi.fn(),
      getConflictRows: vi.fn().mockResolvedValue([
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
      ]),
      upsertTransaction: vi.fn(),
      enqueueTransactionSync: vi.fn(),
      resolveConflictRow: vi.fn(),
    });

    const conflicts = await service.listConflicts({ db: {} as never });

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
    const upsertTransaction = vi.fn();
    const enqueueTransactionSync = vi.fn();
    const resolveConflictRow = vi.fn();
    const refreshTransactions = vi.fn();
    const getConflictRows = vi
      .fn()
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([]);

    const service = createSyncService({
      network: { isOnline: vi.fn().mockResolvedValue(true) },
      supabase: { getSupabase: vi.fn() },
      syncPull: vi.fn(),
      syncPush: vi.fn(),
      refreshTransactions,
      getConflictRows,
      upsertTransaction,
      enqueueTransactionSync,
      resolveConflictRow,
      clock: {
        now: () => new Date(resolvedAt),
        nowIsoDateTime: () => resolvedAt,
      },
    });

    const result = await service.resolveConflict({
      db: {} as never,
      conflictId: "conflict-1" as never,
      resolution: "local",
    });

    expect(upsertTransaction).toHaveBeenCalledWith(
      {} as never,
      expect.objectContaining({
        id: "tx-1",
        amount: 1000,
        source: "manual",
        updatedAt: resolvedAt,
      })
    );
    expect(enqueueTransactionSync).toHaveBeenCalledWith({} as never, "tx-1", resolvedAt);
    expect(resolveConflictRow).toHaveBeenCalledWith({} as never, "conflict-1", "local", resolvedAt);
    expect(refreshTransactions).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ unresolvedConflicts: 0 });
  });

  it("still resolves server conflicts when localData is malformed", async () => {
    const upsertTransaction = vi.fn();
    const enqueueTransactionSync = vi.fn();
    const resolveConflictRow = vi.fn();
    const refreshTransactions = vi.fn();
    const getConflictRows = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "conflict-1",
          transactionId: "tx-1",
          localData: "{not-json",
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
      ])
      .mockResolvedValueOnce([]);

    const service = createSyncService({
      network: { isOnline: vi.fn().mockResolvedValue(true) },
      supabase: { getSupabase: vi.fn() },
      syncPull: vi.fn(),
      syncPush: vi.fn(),
      refreshTransactions,
      getConflictRows,
      upsertTransaction,
      enqueueTransactionSync,
      resolveConflictRow,
    });

    const result = await service.resolveConflict({
      db: {} as never,
      conflictId: "conflict-1" as never,
      resolution: "server",
    });

    expect(upsertTransaction).not.toHaveBeenCalled();
    expect(enqueueTransactionSync).not.toHaveBeenCalled();
    expect(resolveConflictRow).toHaveBeenCalledWith(
      {} as never,
      "conflict-1",
      "server",
      expect.any(String)
    );
    expect(refreshTransactions).toHaveBeenCalledWith({ db: {} as never, userId: "user-1" });
    expect(result).toEqual({ unresolvedConflicts: 0 });
  });
});
