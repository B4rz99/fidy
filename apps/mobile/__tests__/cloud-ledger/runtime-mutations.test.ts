import NetInfo from "@react-native-community/netinfo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  discardCloudLedgerRepairItemForUser,
  enqueueCloudLedgerOptimisticAmend,
  enqueueCloudLedgerOptimisticCreate,
  enqueueCloudLedgerOptimisticDelete,
  flushCloudLedgerOutboxForUser,
  restoreCloudLedgerOptimisticRuntimeState,
  retryCloudLedgerRepairItemForUser,
} from "@/features/cloud-ledger/runtime-mutations";
import { requireUserId } from "@/shared/types/assertions";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  LedgerChangeId,
  TransactionId,
} from "@/shared/types/branded";
import { getSupabase } from "@/shared/db/supabase";

const mocks = vi.hoisted(() => {
  const cache = { cursor: null, transactions: [] };
  const emptyCache = { cursor: null, transactions: [], source: "empty" };
  const outbox = { id: "outbox", markForRepair: vi.fn<(...args: any[]) => any>() };
  const writeToken = { generation: 1 };
  const abortSignal = new AbortController().signal;
  return {
    abortSignal,
    cache,
    emptyCache,
    flushedCache: { cursor: "flushed", transactions: [] },
    optimisticCache: { cursor: "optimistic", transactions: [] },
    outbox,
    refreshedRepairBaseCache: { cursor: "refreshed-repair-base", transactions: [] },
    writeToken,
    flushToken: { generation: 2 },
    beginCloudLedgerRuntimeCacheFlush: vi.fn<(...args: any[]) => any>(),
    beginCloudLedgerRuntimeCacheWrite: vi.fn<(...args: any[]) => any>(),
    createCloudLedgerRuntimeCacheWriteAbortSignal: vi.fn<(...args: any[]) => any>(),
    amendOfflineCloudLedgerTransaction: vi.fn<(...args: any[]) => any>(),
    createEmptyCloudLedgerCache: vi.fn<(...args: any[]) => any>(),
    createOfflineCloudLedgerTransaction: vi.fn<(...args: any[]) => any>(),
    deleteOfflineCloudLedgerTransaction: vi.fn<(...args: any[]) => any>(),
    discardCloudLedgerRepairItem: vi.fn<(...args: any[]) => any>(),
    finishCloudLedgerRuntimeCacheWrite: vi.fn<(...args: any[]) => any>(),
    flushPendingCloudLedgerChanges: vi.fn<(...args: any[]) => any>(),
    getCloudLedgerOutbox: vi.fn<(...args: any[]) => any>(),
    getCloudLedgerRuntimeCache: vi.fn<(...args: any[]) => any>(),
    getSupabase: vi.fn<(...args: any[]) => any>(),
    isCloudLedgerRuntimeCacheWriteCurrent: vi.fn<(...args: any[]) => any>(),
    loadCloudLedgerRepairItems: vi.fn<(...args: any[]) => any>(),
    releaseCloudLedgerRuntimeCacheWriteAbortSignal: vi.fn<(...args: any[]) => any>(),
    refreshCloudLedgerCache: vi.fn<(...args: any[]) => any>(),
    restoreOptimisticCloudLedgerCache: vi.fn<(...args: any[]) => any>(),
    resumeCloudLedgerRuntimeCacheWrites: vi.fn<(...args: any[]) => any>(),
    retryCloudLedgerRepairItem: vi.fn<(...args: any[]) => any>(),
    setCloudLedgerRuntimeCacheIfCurrent: vi.fn<(...args: any[]) => any>(),
  };
});

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: vi.fn<(...args: any[]) => any>(),
  },
}));

vi.mock("@/features/cloud-ledger/outbox", () => ({
  amendOfflineCloudLedgerTransaction: mocks.amendOfflineCloudLedgerTransaction,
  createOfflineCloudLedgerTransaction: mocks.createOfflineCloudLedgerTransaction,
  deleteOfflineCloudLedgerTransaction: mocks.deleteOfflineCloudLedgerTransaction,
  discardCloudLedgerRepairItem: mocks.discardCloudLedgerRepairItem,
  flushPendingCloudLedgerChanges: mocks.flushPendingCloudLedgerChanges,
  getCloudLedgerOutbox: mocks.getCloudLedgerOutbox,
  loadCloudLedgerRepairItems: mocks.loadCloudLedgerRepairItems,
  restoreOptimisticCloudLedgerCache: mocks.restoreOptimisticCloudLedgerCache,
  retryCloudLedgerRepairItem: mocks.retryCloudLedgerRepairItem,
}));

vi.mock("@/features/cloud-ledger/cache", () => ({
  createEmptyCloudLedgerCache: mocks.createEmptyCloudLedgerCache,
  refreshCloudLedgerCache: mocks.refreshCloudLedgerCache,
}));

vi.mock("@/features/cloud-ledger/runtime", () => ({
  beginCloudLedgerRuntimeCacheFlush: mocks.beginCloudLedgerRuntimeCacheFlush,
  beginCloudLedgerRuntimeCacheWrite: mocks.beginCloudLedgerRuntimeCacheWrite,
  createCloudLedgerRuntimeCacheWriteAbortSignal:
    mocks.createCloudLedgerRuntimeCacheWriteAbortSignal,
  finishCloudLedgerRuntimeCacheWrite: mocks.finishCloudLedgerRuntimeCacheWrite,
  getCloudLedgerRuntimeCache: mocks.getCloudLedgerRuntimeCache,
  isCloudLedgerRuntimeCacheWriteCurrent: mocks.isCloudLedgerRuntimeCacheWriteCurrent,
  releaseCloudLedgerRuntimeCacheWriteAbortSignal:
    mocks.releaseCloudLedgerRuntimeCacheWriteAbortSignal,
  resumeCloudLedgerRuntimeCacheWrites: mocks.resumeCloudLedgerRuntimeCacheWrites,
  setCloudLedgerRuntimeCacheIfCurrent: mocks.setCloudLedgerRuntimeCacheIfCurrent,
}));

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

describe("Cloud Ledger runtime mutations", () => {
  const userId = requireUserId("user-cloud-ledger-runtime-mutations");

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.beginCloudLedgerRuntimeCacheFlush.mockReturnValue(mocks.flushToken);
    mocks.beginCloudLedgerRuntimeCacheWrite.mockReturnValue(mocks.writeToken);
    mocks.createCloudLedgerRuntimeCacheWriteAbortSignal.mockReturnValue(mocks.abortSignal);
    mocks.amendOfflineCloudLedgerTransaction.mockResolvedValue(mocks.optimisticCache);
    mocks.createEmptyCloudLedgerCache.mockReturnValue(mocks.emptyCache);
    mocks.createOfflineCloudLedgerTransaction.mockResolvedValue(mocks.optimisticCache);
    mocks.deleteOfflineCloudLedgerTransaction.mockResolvedValue(mocks.optimisticCache);
    mocks.discardCloudLedgerRepairItem.mockResolvedValue(undefined);
    mocks.flushPendingCloudLedgerChanges.mockResolvedValue(mocks.flushedCache);
    mocks.getCloudLedgerOutbox.mockReturnValue(mocks.outbox);
    mocks.getCloudLedgerRuntimeCache.mockReturnValue(mocks.cache);
    mocks.isCloudLedgerRuntimeCacheWriteCurrent.mockReturnValue(true);
    mocks.loadCloudLedgerRepairItems.mockResolvedValue([]);
    mocks.refreshCloudLedgerCache.mockResolvedValue(mocks.refreshedRepairBaseCache);
    mocks.restoreOptimisticCloudLedgerCache.mockResolvedValue(mocks.optimisticCache);
    mocks.retryCloudLedgerRepairItem.mockResolvedValue(undefined);
    mocks.setCloudLedgerRuntimeCacheIfCurrent.mockReturnValue(true);
    mocks.outbox.markForRepair.mockResolvedValue(undefined);
    vi.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as never);
    vi.mocked(getSupabase).mockReturnValue({
      auth: {
        getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
          data: { session: { access_token: "access-token", user: { id: userId } } },
          error: null,
        }),
      },
    } as never);
  });

  it("restores optimistic cache through the current runtime generation", async () => {
    await expect(restoreCloudLedgerOptimisticRuntimeState(userId)).resolves.toBe(true);

    expect(mocks.resumeCloudLedgerRuntimeCacheWrites).toHaveBeenCalledWith(userId);
    expect(mocks.beginCloudLedgerRuntimeCacheWrite).toHaveBeenCalledWith(userId);
    expect(mocks.restoreOptimisticCloudLedgerCache).toHaveBeenCalledWith({
      cache: mocks.cache,
      outbox: mocks.outbox,
    });
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).toHaveBeenCalledWith(
      userId,
      mocks.writeToken,
      mocks.optimisticCache
    );
  });

  it("does not report a restore write when generation is stale after outbox restore", async () => {
    mocks.setCloudLedgerRuntimeCacheIfCurrent.mockReturnValueOnce(false);

    await expect(restoreCloudLedgerOptimisticRuntimeState(userId)).resolves.toBe(false);

    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).toHaveBeenCalledWith(
      userId,
      mocks.writeToken,
      mocks.optimisticCache
    );
  });

  it("discards a repair item by rebuilding runtime state from a fresh accepted cache", async () => {
    const changeId = "ledger-change-discard" as LedgerChangeId;

    await expect(discardCloudLedgerRepairItemForUser(userId, changeId)).resolves.toBe(true);

    expect(mocks.createEmptyCloudLedgerCache).toHaveBeenCalled();
    expect(mocks.refreshCloudLedgerCache).toHaveBeenCalledWith(expect.anything(), mocks.emptyCache);
    expect(mocks.discardCloudLedgerRepairItem).toHaveBeenCalledWith(mocks.outbox, changeId);
    expect(mocks.restoreOptimisticCloudLedgerCache).toHaveBeenCalledWith({
      cache: mocks.refreshedRepairBaseCache,
      outbox: mocks.outbox,
    });
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).toHaveBeenCalledWith(
      userId,
      mocks.writeToken,
      mocks.optimisticCache
    );
  });

  it("does not start outbox flush when the generation is already stale", async () => {
    mocks.beginCloudLedgerRuntimeCacheFlush.mockReturnValueOnce(null);

    await expect(flushCloudLedgerOutboxForUser(userId)).resolves.toBe(false);

    expect(mocks.beginCloudLedgerRuntimeCacheFlush).toHaveBeenCalledWith(userId);
    expect(mocks.beginCloudLedgerRuntimeCacheWrite).not.toHaveBeenCalled();
    expect(mocks.flushPendingCloudLedgerChanges).not.toHaveBeenCalled();
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).not.toHaveBeenCalled();
  });

  it("does not report a flushed write when generation is stale after remote flush", async () => {
    mocks.setCloudLedgerRuntimeCacheIfCurrent.mockReturnValueOnce(false);

    await expect(flushCloudLedgerOutboxForUser(userId)).resolves.toBe(false);

    expect(mocks.flushPendingCloudLedgerChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        cache: mocks.cache,
        outbox: mocks.outbox,
        shouldContinue: expect.any(Function),
      })
    );
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).toHaveBeenCalledWith(
      userId,
      mocks.flushToken,
      mocks.flushedCache
    );
    expect(mocks.releaseCloudLedgerRuntimeCacheWriteAbortSignal).toHaveBeenCalledWith(
      userId,
      mocks.flushToken,
      mocks.abortSignal
    );
  });

  it("does not invalidate an active optimistic create when a background flush starts", async () => {
    mocks.beginCloudLedgerRuntimeCacheFlush.mockReturnValueOnce(null);

    await expect(flushCloudLedgerOutboxForUser(userId)).resolves.toBe(false);

    expect(mocks.beginCloudLedgerRuntimeCacheFlush).toHaveBeenCalledWith(userId);
    expect(mocks.beginCloudLedgerRuntimeCacheWrite).not.toHaveBeenCalled();
    expect(mocks.flushPendingCloudLedgerChanges).not.toHaveBeenCalled();
  });

  it("enqueues optimistic create and exposes an online flush callback tied to the same token", async () => {
    const result = await enqueueCloudLedgerOptimisticCreate({
      userId,
      changeId: "ledger-change-1" as LedgerChangeId,
      command: makeCreateCommand(),
      createdAt: "2026-06-20T10:00:00.000Z" as IsoDateTime,
    });

    expect(result.didWriteRuntimeCache).toBe(true);
    expect(mocks.createOfflineCloudLedgerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        cache: mocks.cache,
        outbox: mocks.outbox,
      })
    );

    await result.flushIfOnline();

    expect(NetInfo.fetch).toHaveBeenCalled();
    expect(mocks.flushPendingCloudLedgerChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        cache: mocks.cache,
        outbox: mocks.outbox,
        shouldContinue: expect.any(Function),
      })
    );
    expect(mocks.releaseCloudLedgerRuntimeCacheWriteAbortSignal).toHaveBeenCalledWith(
      userId,
      mocks.writeToken,
      mocks.abortSignal
    );
  });

  it("skips optimistic-create flush when the runtime cache write was stale", async () => {
    mocks.setCloudLedgerRuntimeCacheIfCurrent.mockReturnValueOnce(false);

    const result = await enqueueCloudLedgerOptimisticCreate({
      userId,
      changeId: "ledger-change-1" as LedgerChangeId,
      command: makeCreateCommand(),
      createdAt: "2026-06-20T10:00:00.000Z" as IsoDateTime,
    });
    await result.flushIfOnline();

    expect(result.didWriteRuntimeCache).toBe(false);
    expect(NetInfo.fetch).not.toHaveBeenCalled();
    expect(mocks.flushPendingCloudLedgerChanges).not.toHaveBeenCalled();
  });

  it("enqueues optimistic amend with the accepted transaction version", async () => {
    const result = await enqueueCloudLedgerOptimisticAmend({
      userId,
      changeId: "ledger-change-amend" as LedgerChangeId,
      transaction: makeAcceptedTransaction({ version: 3 }),
      expectedVersion: 3,
      createdAt: "2026-06-20T10:05:00.000Z" as IsoDateTime,
    });

    expect(result.didWriteRuntimeCache).toBe(true);
    expect(mocks.amendOfflineCloudLedgerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        cache: mocks.cache,
        outbox: mocks.outbox,
        expectedVersion: 3,
        transaction: expect.objectContaining({
          id: "txn-1",
          version: 3,
        }),
      })
    );
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).toHaveBeenCalledWith(
      userId,
      mocks.writeToken,
      mocks.optimisticCache
    );
  });

  it("enqueues optimistic delete with the accepted transaction version", async () => {
    const result = await enqueueCloudLedgerOptimisticDelete({
      userId,
      changeId: "ledger-change-delete" as LedgerChangeId,
      transactionId: "txn-1" as TransactionId,
      expectedVersion: 4,
      createdAt: "2026-06-20T10:06:00.000Z" as IsoDateTime,
    });

    expect(result.didWriteRuntimeCache).toBe(true);
    expect(mocks.deleteOfflineCloudLedgerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        cache: mocks.cache,
        outbox: mocks.outbox,
        expectedVersion: 4,
        transactionId: "txn-1",
      })
    );
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).toHaveBeenCalledWith(
      userId,
      mocks.writeToken,
      mocks.optimisticCache
    );
  });

  it("does not flush another user's outbox when the Supabase session changes before flush", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce({
      auth: {
        getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
          data: {
            session: {
              access_token: "access-token-for-user-2",
              user: { id: "user-2" },
            },
          },
          error: null,
        }),
      },
    } as never);

    const result = await enqueueCloudLedgerOptimisticCreate({
      userId,
      changeId: "ledger-change-1" as LedgerChangeId,
      command: makeCreateCommand(),
      createdAt: "2026-06-20T10:00:00.000Z" as IsoDateTime,
    });
    await result.flushIfOnline();

    expect(result.didWriteRuntimeCache).toBe(true);
    expect(NetInfo.fetch).toHaveBeenCalled();
    expect(mocks.flushPendingCloudLedgerChanges).not.toHaveBeenCalled();
    expect(mocks.createCloudLedgerRuntimeCacheWriteAbortSignal).not.toHaveBeenCalled();
  });

  it("does not enqueue optimistic create when runtime writes are already suspended", async () => {
    mocks.isCloudLedgerRuntimeCacheWriteCurrent.mockReturnValueOnce(false);

    const result = await enqueueCloudLedgerOptimisticCreate({
      userId,
      changeId: "ledger-change-1" as LedgerChangeId,
      command: makeCreateCommand(),
      createdAt: "2026-06-20T10:00:00.000Z" as IsoDateTime,
    });
    await result.flushIfOnline();

    expect(result.didWriteRuntimeCache).toBe(false);
    expect(mocks.createOfflineCloudLedgerTransaction).not.toHaveBeenCalled();
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).not.toHaveBeenCalled();
    expect(NetInfo.fetch).not.toHaveBeenCalled();
    expect(mocks.flushPendingCloudLedgerChanges).not.toHaveBeenCalled();
  });

  it("restores a repair marker when retry cannot run a flush", async () => {
    const changeId = "ledger-change-retry" as LedgerChangeId;
    const repairItem = {
      id: changeId,
      outcome: { changeId, status: "retryable", code: "edge_function_unavailable" },
      parentChangeId: "ledger-change-parent" as LedgerChangeId,
      acceptedTransactionVersion: 5,
    };
    mocks.loadCloudLedgerRepairItems.mockResolvedValueOnce([repairItem]);
    vi.mocked(getSupabase).mockReturnValueOnce({
      auth: {
        getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    } as never);

    await expect(retryCloudLedgerRepairItemForUser(userId, changeId)).resolves.toBe(false);

    expect(mocks.retryCloudLedgerRepairItem).toHaveBeenCalledWith(mocks.outbox, changeId);
    expect(mocks.outbox.markForRepair).toHaveBeenCalledWith([
      {
        changeId,
        outcome: repairItem.outcome,
        parentChangeId: repairItem.parentChangeId,
        acceptedTransactionVersion: 5,
      },
    ]);
  });
});

function makeCreateCommand() {
  return {
    commandVersion: 1 as const,
    transaction: {
      accountId: "fa-default-user-1" as FinancialAccountId,
      amount: 4520 as CopAmount,
      categoryId: "food" as CategoryId,
      currency: "COP" as const,
      date: "2026-06-20" as IsoDate,
      description: "Groceries",
      id: "txn-1" as TransactionId,
      type: "expense" as const,
    },
  };
}

function makeAcceptedTransaction(overrides: { readonly version: number }) {
  return {
    ...makeCreateCommand().transaction,
    updatedAt: "2026-06-20T10:00:00.000Z" as IsoDateTime,
    version: overrides.version,
  };
}
