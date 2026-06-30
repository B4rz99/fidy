import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cloudLedgerIndexSource = readFileSync(
  resolve(__dirname, "../../../../supabase/functions/cloud-ledger-api/index.ts"),
  "utf8"
);

describe("cloud-ledger-api Edge Function source", () => {
  it("prefers a narrow Cloud Ledger database key with service role as fallback", () => {
    const ledgerKeyIndex = cloudLedgerIndexSource.indexOf("SUPABASE_LEDGER_API_KEY");
    const serviceRoleIndex = cloudLedgerIndexSource.indexOf("SUPABASE_SERVICE_ROLE_KEY");

    expect(ledgerKeyIndex).toBeGreaterThanOrEqual(0);
    expect(serviceRoleIndex).toBeGreaterThanOrEqual(0);
    expect(ledgerKeyIndex).toBeLessThan(serviceRoleIndex);
    expect(cloudLedgerIndexSource).toContain("createCloudLedgerConsoleTelemetry");
  });
});
