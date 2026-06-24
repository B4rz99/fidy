import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cloudLedgerBootstrapTask,
  flushCloudLedgerOutboxForUser,
  restoreCloudLedgerOptimisticState,
} from "@/features/cloud-ledger/bootstrap";
import { requireUserId } from "@/shared/types/assertions";

const mocks = vi.hoisted(() => {
  return {
    captureWarning: vi.fn(),
    flushCloudLedgerOutboxForUser: vi.fn<(...args: any[]) => any>(),
    restoreCloudLedgerOptimisticRuntimeState: vi.fn<(...args: any[]) => any>(),
  };
});

vi.mock("@/features/cloud-ledger/runtime-mutations", () => ({
  flushCloudLedgerOutboxForUser: mocks.flushCloudLedgerOutboxForUser,
  restoreCloudLedgerOptimisticRuntimeState: mocks.restoreCloudLedgerOptimisticRuntimeState,
}));

vi.mock("@/shared/lib", () => ({
  captureWarning: mocks.captureWarning,
}));

describe("Cloud Ledger bootstrap task", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreCloudLedgerOptimisticRuntimeState.mockResolvedValue(true);
    mocks.flushCloudLedgerOutboxForUser.mockResolvedValue(true);
  });

  it("keeps authenticated bootstrap alive when the opportunistic outbox flush fails", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    const offlineFailure = new Error("offline");
    offlineFailure.name = "OfflineFlushFailure";
    mocks.flushCloudLedgerOutboxForUser.mockRejectedValueOnce(offlineFailure);

    await expect(
      cloudLedgerBootstrapTask.run({
        db: {} as never,
        enableRemoteEffects: true,
        userId,
      })
    ).resolves.toBeUndefined();

    expect(mocks.restoreCloudLedgerOptimisticRuntimeState).toHaveBeenCalledWith(userId);
    expect(mocks.flushCloudLedgerOutboxForUser).toHaveBeenCalledWith(userId);
    expect(mocks.captureWarning).toHaveBeenCalledWith("cloud_ledger_outbox_flush_failed", {
      errorType: "OfflineFlushFailure",
    });
  });

  it("does not start remote flush when remote effects are disabled", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    await cloudLedgerBootstrapTask.run({
      db: {} as never,
      enableRemoteEffects: false,
      userId,
    });

    expect(mocks.restoreCloudLedgerOptimisticRuntimeState).toHaveBeenCalledWith(userId);
    expect(mocks.flushCloudLedgerOutboxForUser).not.toHaveBeenCalled();
  });

  it("keeps compatibility exports for direct restore and flush callers", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");

    await restoreCloudLedgerOptimisticState(userId);
    await flushCloudLedgerOutboxForUser(userId);

    expect(mocks.restoreCloudLedgerOptimisticRuntimeState).toHaveBeenCalledWith(userId);
    expect(mocks.flushCloudLedgerOutboxForUser).toHaveBeenCalledWith(userId);
  });
});
