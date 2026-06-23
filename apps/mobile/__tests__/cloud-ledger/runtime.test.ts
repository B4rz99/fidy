import { beforeEach, describe, expect, it } from "vitest";
import {
  beginCloudLedgerRuntimeCacheWrite,
  isCloudLedgerRuntimeCacheWriteCurrent,
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
});
