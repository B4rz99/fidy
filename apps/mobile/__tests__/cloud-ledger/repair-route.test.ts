import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { expectRouteInRootStackGroup } from "@/__tests__/helpers/root-stack-routes";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const settingsSource = readSource("../../features/settings/components/SettingsScreen.tsx");
const rootStackRoutesSource = readSource("../../shared/navigation/root-stack-routes.ts");
const repairRouteSource = readSource("../../app/ledger-repair.tsx");
const editRouteSource = readSource("../../app/ledger-repair-transaction.tsx");
const repairScreenSource = readSource(
  "../../features/cloud-ledger/components/CloudLedgerRepairScreen.tsx"
);
const repairEditScreenSource = readSource(
  "../../features/cloud-ledger/components/CloudLedgerRepairTransactionScreen.tsx"
);
const uiPublicSource = readSource("../../features/cloud-ledger/ui.public.ts");

test("Ledger Repair is reachable from settings and registered in the root stack", () => {
  expect(settingsSource).toContain('push("/ledger-repair")');
  expect(settingsSource).toContain('t("cloudLedger.repair.settingsRow")');
  expect(repairRouteSource).toContain("CloudLedgerRepairScreen");
  expect(repairRouteSource).toContain("@/features/cloud-ledger/ui.public");
  expect(editRouteSource).toContain("CloudLedgerRepairTransactionScreen");
  expect(editRouteSource).toContain("@/features/cloud-ledger/ui.public");
  expectRouteInRootStackGroup(rootStackRoutesSource, "transparentHeader", "ledger-repair");
  expectRouteInRootStackGroup(rootStackRoutesSource, "entry", "ledger-repair-transaction");
  expect(uiPublicSource).toContain("CloudLedgerRepairScreen");
  expect(uiPublicSource).toContain("CloudLedgerRepairTransactionScreen");
});

test("Ledger Repair screen wires visible repairs to retry, discard, and edit actions", () => {
  expect(repairScreenSource).toContain("loadCloudLedgerRepairItems");
  expect(repairScreenSource).toContain("retryCloudLedgerRepairItemForUser");
  expect(repairScreenSource).toContain("retryCloudLedgerRepairSetForUser");
  expect(repairScreenSource).toContain("discardCloudLedgerRepairItemForUser");
  expect(repairScreenSource).toContain('pathname: "/ledger-repair-transaction"');
});

test("Ledger Repair transaction screen resubmits editable pending transaction repairs", () => {
  expect(repairEditScreenSource).toContain("TransactionForm");
  expect(repairEditScreenSource).toContain("resubmitCloudLedgerRepairTransactionChangeForUser");
  expect(repairEditScreenSource).toContain("acceptedTransactionVersion");
  expect(repairEditScreenSource).not.toContain("setCloudLedgerRuntimeCache(");
  expect(repairEditScreenSource).toContain("flushCloudLedgerOutboxForUser");
  expect(repairEditScreenSource).toContain('replace("/ledger-repair")');
});
