import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloudLedgerBootstrapTask } from "@/features/cloud-ledger/bootstrap";
import { requireUserId } from "@/shared/types/assertions";

const mocks = vi.hoisted(() => {
  const cache = { cursor: null };
  const outbox = { id: "outbox" };
  return {
    cache,
    outbox,
    captureWarning: vi.fn(),
    flushPendingCloudLedgerChanges: vi.fn(),
    getCloudLedgerOutbox: vi.fn(),
    getCloudLedgerRuntimeCache: vi.fn(),
    getSupabase: vi.fn(),
    restoreOptimisticCloudLedgerCache: vi.fn(),
    setCloudLedgerRuntimeCache: vi.fn(),
  };
});

vi.mock("@/features/cloud-ledger/public", () => ({
  flushPendingCloudLedgerChanges: mocks.flushPendingCloudLedgerChanges,
  getCloudLedgerOutbox: mocks.getCloudLedgerOutbox,
  getCloudLedgerRuntimeCache: mocks.getCloudLedgerRuntimeCache,
  restoreOptimisticCloudLedgerCache: mocks.restoreOptimisticCloudLedgerCache,
  setCloudLedgerRuntimeCache: mocks.setCloudLedgerRuntimeCache,
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
    mocks.getCloudLedgerRuntimeCache.mockReturnValue(mocks.cache);
    mocks.getCloudLedgerOutbox.mockReturnValue(mocks.outbox);
    mocks.getSupabase.mockReturnValue({ functions: { invoke: vi.fn() } });
    mocks.restoreOptimisticCloudLedgerCache.mockResolvedValue({ cursor: "optimistic" });
    mocks.flushPendingCloudLedgerChanges.mockResolvedValue({ cursor: "flushed" });
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
    expect(mocks.setCloudLedgerRuntimeCache).toHaveBeenCalledWith(userId, {
      cursor: "optimistic",
    });
    expect(mocks.captureWarning).toHaveBeenCalledWith("cloud_ledger_outbox_flush_failed", {
      errorType: "OfflineFlushFailure",
    });
  });
});
