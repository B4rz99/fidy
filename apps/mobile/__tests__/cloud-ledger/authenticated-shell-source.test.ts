import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authenticatedShellSource = readFileSync(
  resolve(__dirname, "../../bootstrap/authenticated-shell.ts"),
  "utf-8"
).replace(/\r\n/g, "\n");

describe("Cloud Ledger authenticated shell wiring", () => {
  it("runs Cloud Ledger outbox restore at bootstrap and subscribes reconnect flushes", () => {
    expect(authenticatedShellSource).toContain(
      "cloudLedgerBootstrapTask,\n  notificationsBootstrapTask"
    );
    expect(authenticatedShellSource).toContain(
      "cloudLedgerReconnectFlushTask,\n  budgetTransactionSubscriptionTask"
    );
  });
});
