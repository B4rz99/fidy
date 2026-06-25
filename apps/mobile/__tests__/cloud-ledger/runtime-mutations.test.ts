import NetInfo from "@react-native-community/netinfo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueCloudLedgerOptimisticCreate,
  flushCloudLedgerOutboxForUser,
  restoreCloudLedgerOptimisticRuntimeState,
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
  const outbox = { id: "outbox" };
  const writeToken = { generation: 1 };
  return {
    cache,
    flushedCache: { cursor: "flushed", transactions: [] },
    optimisticCache: { cursor: "optimistic", transactions: [] },
    outbox,
    writeToken,
    beginCloudLedgerRuntimeCacheWrite: vi.fn<(...args: any[]) => any>(),
    createCloudLedgerRuntimeCacheWriteAbortSignal: vi.fn<(...args: any[]) => any>(),
    createOfflineCloudLedgerTransaction: vi.fn<(...args: any[]) => any>(),
    flushPendingCloudLedgerChanges: vi.fn<(...args: any[]) => any>(),
    getCloudLedgerOutbox: vi.fn<(...args: any[]) => any>(),
    getCloudLedgerRuntimeCache: vi.fn<(...args: any[]) => any>(),
    getSupabase: vi.fn<(...args: any[]) => any>(),
    isCloudLedgerRuntimeCacheWriteCurrent: vi.fn<(...args: any[]) => any>(),
    restoreOptimisticCloudLedgerCache: vi.fn<(...args: any[]) => any>(),
    resumeCloudLedgerRuntimeCacheWrites: vi.fn<(...args: any[]) => any>(),
    setCloudLedgerRuntimeCacheIfCurrent: vi.fn<(...args: any[]) => any>(),
  };
});

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: vi.fn<(...args: any[]) => any>(),
  },
}));

vi.mock("@/features/cloud-ledger/outbox", () => ({
  createOfflineCloudLedgerTransaction: mocks.createOfflineCloudLedgerTransaction,
  flushPendingCloudLedgerChanges: mocks.flushPendingCloudLedgerChanges,
  getCloudLedgerOutbox: mocks.getCloudLedgerOutbox,
  restoreOptimisticCloudLedgerCache: mocks.restoreOptimisticCloudLedgerCache,
}));

vi.mock("@/features/cloud-ledger/runtime", () => ({
  beginCloudLedgerRuntimeCacheWrite: mocks.beginCloudLedgerRuntimeCacheWrite,
  createCloudLedgerRuntimeCacheWriteAbortSignal:
    mocks.createCloudLedgerRuntimeCacheWriteAbortSignal,
  getCloudLedgerRuntimeCache: mocks.getCloudLedgerRuntimeCache,
  isCloudLedgerRuntimeCacheWriteCurrent: mocks.isCloudLedgerRuntimeCacheWriteCurrent,
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
    mocks.beginCloudLedgerRuntimeCacheWrite.mockReturnValue(mocks.writeToken);
    mocks.createCloudLedgerRuntimeCacheWriteAbortSignal.mockReturnValue(
      new AbortController().signal
    );
    mocks.createOfflineCloudLedgerTransaction.mockResolvedValue(mocks.optimisticCache);
    mocks.flushPendingCloudLedgerChanges.mockResolvedValue(mocks.flushedCache);
    mocks.getCloudLedgerOutbox.mockReturnValue(mocks.outbox);
    mocks.getCloudLedgerRuntimeCache.mockReturnValue(mocks.cache);
    mocks.isCloudLedgerRuntimeCacheWriteCurrent.mockReturnValue(true);
    mocks.restoreOptimisticCloudLedgerCache.mockResolvedValue(mocks.optimisticCache);
    mocks.setCloudLedgerRuntimeCacheIfCurrent.mockReturnValue(true);
    vi.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as never);
    vi.mocked(getSupabase).mockReturnValue({
      auth: {
        getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
          data: { session: { access_token: "access-token" } },
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

  it("does not start outbox flush when the generation is already stale", async () => {
    mocks.isCloudLedgerRuntimeCacheWriteCurrent.mockReturnValueOnce(false);

    await expect(flushCloudLedgerOutboxForUser(userId)).resolves.toBe(false);

    expect(mocks.beginCloudLedgerRuntimeCacheWrite).toHaveBeenCalledWith(userId);
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
      mocks.writeToken,
      mocks.flushedCache
    );
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
