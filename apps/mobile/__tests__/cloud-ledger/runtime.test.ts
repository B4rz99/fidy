import { beforeEach, describe, expect, it } from "vitest";
import {
  beginCloudLedgerRuntimeCacheWrite,
  createCloudLedgerRuntimeCacheWriteAbortSignal,
  isCloudLedgerRuntimeCacheWriteCurrent,
  releaseCloudLedgerRuntimeCacheWriteAbortSignal,
  resetCloudLedgerRuntimeCaches,
  resumeCloudLedgerRuntimeCacheWrites,
  suspendCloudLedgerRuntimeCacheWrites,
} from "@/features/cloud-ledger/public";
import { requireUserId } from "@/shared/types/assertions";

describe("Cloud Ledger runtime cache write tokens", () => {
  beforeEach(() => {
    resetCloudLedgerRuntimeCaches();
  });

  it("keeps writes started during logout discard stale until the next runtime session", () => {
    const userId = requireUserId("user-cloud-ledger-runtime");
    const beforeDiscard = beginCloudLedgerRuntimeCacheWrite(userId);

    suspendCloudLedgerRuntimeCacheWrites(userId);
    const duringDiscard = beginCloudLedgerRuntimeCacheWrite(userId);

    expect(isCloudLedgerRuntimeCacheWriteCurrent(userId, beforeDiscard)).toBe(false);
    expect(isCloudLedgerRuntimeCacheWriteCurrent(userId, duringDiscard)).toBe(false);

    resumeCloudLedgerRuntimeCacheWrites(userId);

    expect(isCloudLedgerRuntimeCacheWriteCurrent(userId, duringDiscard)).toBe(false);
    expect(
      isCloudLedgerRuntimeCacheWriteCurrent(userId, beginCloudLedgerRuntimeCacheWrite(userId))
    ).toBe(true);
  });

  it("aborts generation-bound remote work when logout discard suspends writes", () => {
    const userId = requireUserId("user-cloud-ledger-runtime");
    const writeToken = beginCloudLedgerRuntimeCacheWrite(userId);
    const signal = createCloudLedgerRuntimeCacheWriteAbortSignal(userId, writeToken);

    expect(signal).not.toBeNull();
    expect(signal?.aborted).toBe(false);

    suspendCloudLedgerRuntimeCacheWrites(userId);

    expect(signal?.aborted).toBe(true);
  });

  it("does not abort completed generation-bound remote work after the signal is released", () => {
    const userId = requireUserId("user-cloud-ledger-runtime");
    const writeToken = beginCloudLedgerRuntimeCacheWrite(userId);
    const signal = createCloudLedgerRuntimeCacheWriteAbortSignal(userId, writeToken);

    expect(signal).not.toBeNull();
    releaseCloudLedgerRuntimeCacheWriteAbortSignal(userId, writeToken, signal);
    suspendCloudLedgerRuntimeCacheWrites(userId);

    expect(signal?.aborted).toBe(false);
  });
});
