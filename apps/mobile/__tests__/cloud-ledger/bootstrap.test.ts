import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cloudLedgerBootstrapTask,
  flushCloudLedgerOutboxForUser,
  restoreCloudLedgerOptimisticState,
} from "@/features/cloud-ledger/bootstrap";
import { requireUserId } from "@/shared/types/assertions";

const mocks = vi.hoisted(() => {
  const cache = { cursor: null };
  const outbox = { id: "outbox" };
  const writeToken = { generation: 1 };
  return {
    cache,
    outbox,
    writeToken,
    beginCloudLedgerRuntimeCacheWrite: vi.fn(),
    captureWarning: vi.fn(),
    flushPendingCloudLedgerChanges: vi.fn(),
    getCloudLedgerOutbox: vi.fn(),
    getCloudLedgerRuntimeCache: vi.fn(),
    getSupabase: vi.fn(),
    isCloudLedgerRuntimeCacheWriteCurrent: vi.fn(),
    restoreOptimisticCloudLedgerCache: vi.fn(),
    resumeCloudLedgerRuntimeCacheWrites: vi.fn(),
    setCloudLedgerRuntimeCache: vi.fn(),
    setCloudLedgerRuntimeCacheIfCurrent: vi.fn(),
  };
});

vi.mock("@/features/cloud-ledger/public", () => ({
  beginCloudLedgerRuntimeCacheWrite: mocks.beginCloudLedgerRuntimeCacheWrite,
  flushPendingCloudLedgerChanges: mocks.flushPendingCloudLedgerChanges,
  getCloudLedgerOutbox: mocks.getCloudLedgerOutbox,
  getCloudLedgerRuntimeCache: mocks.getCloudLedgerRuntimeCache,
  isCloudLedgerRuntimeCacheWriteCurrent: mocks.isCloudLedgerRuntimeCacheWriteCurrent,
  restoreOptimisticCloudLedgerCache: mocks.restoreOptimisticCloudLedgerCache,
  resumeCloudLedgerRuntimeCacheWrites: mocks.resumeCloudLedgerRuntimeCacheWrites,
  setCloudLedgerRuntimeCache: mocks.setCloudLedgerRuntimeCache,
  setCloudLedgerRuntimeCacheIfCurrent: mocks.setCloudLedgerRuntimeCacheIfCurrent,
}));

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: mocks.getSupabase,
}));

vi.mock("@/shared/lib", () => ({
  captureWarning: mocks.captureWarning,
}));

describe("Cloud Ledger bootstrap task", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.beginCloudLedgerRuntimeCacheWrite.mockReturnValue(mocks.writeToken);
    mocks.getCloudLedgerRuntimeCache.mockReturnValue(mocks.cache);
    mocks.getCloudLedgerOutbox.mockReturnValue(mocks.outbox);
    mocks.getSupabase.mockReturnValue({ functions: { invoke: vi.fn() } });
    mocks.restoreOptimisticCloudLedgerCache.mockResolvedValue({ cursor: "optimistic" });
    mocks.flushPendingCloudLedgerChanges.mockResolvedValue({ cursor: "flushed" });
    mocks.isCloudLedgerRuntimeCacheWriteCurrent.mockReturnValue(true);
    mocks.setCloudLedgerRuntimeCacheIfCurrent.mockReturnValue(true);
  });

  it("keeps authenticated bootstrap alive when the opportunistic outbox flush fails", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    const offlineFailure = new Error("offline");
    offlineFailure.name = "OfflineFlushFailure";
    mocks.flushPendingCloudLedgerChanges.mockRejectedValueOnce(offlineFailure);

    await expect(
      cloudLedgerBootstrapTask.run({
        db: {} as never,
        enableRemoteEffects: true,
        userId,
      })
    ).resolves.toBeUndefined();

    expect(mocks.restoreOptimisticCloudLedgerCache).toHaveBeenCalledWith({
      cache: mocks.cache,
      outbox: mocks.outbox,
    });
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).toHaveBeenCalledWith(
      userId,
      mocks.writeToken,
      {
        cursor: "optimistic",
      }
    );
    expect(mocks.captureWarning).toHaveBeenCalledWith("cloud_ledger_outbox_flush_failed", {
      errorType: "OfflineFlushFailure",
    });
  });

  it("does not write restored optimistic runtime cache when generation is stale after outbox restore", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    mocks.setCloudLedgerRuntimeCacheIfCurrent.mockReturnValueOnce(false);

    await restoreCloudLedgerOptimisticState(userId);

    expect(mocks.beginCloudLedgerRuntimeCacheWrite).toHaveBeenCalledWith(userId);
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).toHaveBeenCalledWith(
      userId,
      mocks.writeToken,
      {
        cursor: "optimistic",
      }
    );
    expect(mocks.setCloudLedgerRuntimeCache).not.toHaveBeenCalledWith(userId, {
      cursor: "optimistic",
    });
  });

  it("does not start outbox flush when the user generation is already stale", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    mocks.isCloudLedgerRuntimeCacheWriteCurrent.mockReturnValueOnce(false);

    await flushCloudLedgerOutboxForUser(userId);

    expect(mocks.beginCloudLedgerRuntimeCacheWrite).toHaveBeenCalledWith(userId);
    expect(mocks.flushPendingCloudLedgerChanges).not.toHaveBeenCalled();
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).not.toHaveBeenCalled();
  });

  it("does not write flushed runtime cache when the user generation is stale after logout", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    mocks.setCloudLedgerRuntimeCacheIfCurrent.mockReturnValueOnce(false);

    await flushCloudLedgerOutboxForUser(userId);

    expect(mocks.beginCloudLedgerRuntimeCacheWrite).toHaveBeenCalledWith(userId);
    expect(mocks.setCloudLedgerRuntimeCacheIfCurrent).toHaveBeenCalledWith(
      userId,
      mocks.writeToken,
      {
        cursor: "flushed",
      }
    );
    expect(mocks.setCloudLedgerRuntimeCache).not.toHaveBeenCalledWith(userId, {
      cursor: "flushed",
    });
  });
});
