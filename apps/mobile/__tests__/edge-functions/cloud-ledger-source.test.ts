import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readCloudLedgerDatabaseKey } from "../../../../supabase/functions/cloud-ledger-api/database-key";

const cloudLedgerIndexSource = readFileSync(
  resolve(__dirname, "../../../../supabase/functions/cloud-ledger-api/index.ts"),
  "utf8"
);

describe("cloud-ledger-api Edge Function source", () => {
  it("prefers a narrow Cloud Ledger database key before service-role fallback", () => {
    const env = new Map([
      ["SUPABASE_LEDGER_API_KEY", "ledger-api-key"],
      ["SUPABASE_SERVICE_ROLE_KEY", "service-role-key"],
    ]);

    expect(readCloudLedgerDatabaseKey((key) => env.get(key))).toBe("ledger-api-key");
  });

  it("keeps service role as the Cloud Ledger database key fallback", () => {
    const env = new Map([["SUPABASE_SERVICE_ROLE_KEY", "service-role-key"]]);

    expect(readCloudLedgerDatabaseKey((key) => env.get(key))).toBe("service-role-key");
  });

  it("wires command telemetry in the Edge Function entrypoint", () => {
    expect(cloudLedgerIndexSource).toContain("createCloudLedgerConsoleTelemetry");
  });
});
