import { describe, expect, it } from "vitest";
import * as cloudLedgerPublic from "@/features/cloud-ledger/public";

describe("Cloud Ledger public surface", () => {
  it("keeps runtime and outbox mutation APIs off the broad barrel", () => {
    expect(cloudLedgerPublic).not.toHaveProperty("beginCloudLedgerRuntimeCacheWrite");
    expect(cloudLedgerPublic).not.toHaveProperty("setCloudLedgerRuntimeCache");
    expect(cloudLedgerPublic).not.toHaveProperty("enqueueCloudLedgerOptimisticCreate");
    expect(cloudLedgerPublic).not.toHaveProperty("getCloudLedgerOutbox");
  });
});
