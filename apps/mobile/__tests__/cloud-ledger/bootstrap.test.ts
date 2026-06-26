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
    persistCloudLedgerRuntimeTransactionShadows: vi.fn<(...args: any[]) => any>(),
    refreshTransactions: vi.fn<(...args: any[]) => any>(),
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

vi.mock("@/features/transactions/store.public", () => ({
  persistCloudLedgerRuntimeTransactionShadows: mocks.persistCloudLedgerRuntimeTransactionShadows,
  refreshTransactions: mocks.refreshTransactions,
}));

describe("Cloud Ledger bootstrap task", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreCloudLedgerOptimisticRuntimeState.mockResolvedValue(true);
    mocks.flushCloudLedgerOutboxForUser.mockResolvedValue(true);
    mocks.persistCloudLedgerRuntimeTransactionShadows.mockReturnValue(undefined);
    mocks.refreshTransactions.mockResolvedValue(undefined);
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

  it("keeps authenticated bootstrap alive when encrypted outbox restore fails", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    const restoreFailure = new Error("decrypt failed");
    restoreFailure.name = "CloudLedgerOutboxFailure";
    mocks.restoreCloudLedgerOptimisticRuntimeState.mockRejectedValueOnce(restoreFailure);

    await expect(
      cloudLedgerBootstrapTask.run({
        db: {} as never,
        enableRemoteEffects: true,
        userId,
      })
    ).resolves.toBeUndefined();

    expect(mocks.captureWarning).toHaveBeenCalledWith("cloud_ledger_outbox_restore_failed", {
      errorType: "CloudLedgerOutboxFailure",
    });
    expect(mocks.flushCloudLedgerOutboxForUser).toHaveBeenCalledWith(userId);
  });

  it("persists runtime Cloud Ledger rows before refreshing ordinary transaction views", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    const db = {} as never;

    await cloudLedgerBootstrapTask.run({
      db,
      enableRemoteEffects: true,
      userId,
    });
    await Promise.resolve();

    expect(mocks.persistCloudLedgerRuntimeTransactionShadows).toHaveBeenCalledWith(db, userId);
    expect(mocks.refreshTransactions).toHaveBeenCalledWith(db, userId);
    expect(
      mocks.persistCloudLedgerRuntimeTransactionShadows.mock.invocationCallOrder[0]!
    ).toBeLessThan(mocks.refreshTransactions.mock.invocationCallOrder[0]!);
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

  it("does not start a remote flush when bootstrap becomes stale during restore", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    let isCurrent = true;
    mocks.restoreCloudLedgerOptimisticRuntimeState.mockImplementationOnce(() => {
      isCurrent = false;
      return Promise.resolve(true);
    });

    await cloudLedgerBootstrapTask.run({
      db: {} as never,
      enableRemoteEffects: true,
      isCurrent: () => isCurrent,
      userId,
    });

    expect(mocks.restoreCloudLedgerOptimisticRuntimeState).toHaveBeenCalledWith(userId);
    expect(mocks.flushCloudLedgerOutboxForUser).not.toHaveBeenCalled();
  });

  it("does not persist flushed rows when bootstrap becomes stale during remote flush", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");
    const db = {} as never;
    const flush = createDeferred<boolean>();
    let isCurrent = true;
    mocks.flushCloudLedgerOutboxForUser.mockReturnValueOnce(flush.promise);

    await cloudLedgerBootstrapTask.run({
      db,
      enableRemoteEffects: true,
      isCurrent: () => isCurrent,
      userId,
    });
    isCurrent = false;
    flush.resolve(true);
    await Promise.resolve();

    expect(mocks.flushCloudLedgerOutboxForUser).toHaveBeenCalledWith(userId);
    expect(mocks.persistCloudLedgerRuntimeTransactionShadows).not.toHaveBeenCalled();
    expect(mocks.refreshTransactions).not.toHaveBeenCalled();
  });

  it("keeps compatibility exports for direct restore and flush callers", async () => {
    const userId = requireUserId("user-cloud-ledger-bootstrap");

    await restoreCloudLedgerOptimisticState(userId);
    await flushCloudLedgerOutboxForUser(userId);

    expect(mocks.restoreCloudLedgerOptimisticRuntimeState).toHaveBeenCalledWith(userId);
    expect(mocks.flushCloudLedgerOutboxForUser).toHaveBeenCalledWith(userId);
  });
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}
