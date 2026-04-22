import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

function readTransferFormSource() {
  return [
    readSource("../../features/transfers/components/TransferFormScreen.tsx"),
    readSource("../../features/transfers/components/transfer-form/TransferFormContent.tsx"),
    readSource("../../features/transfers/components/transfer-form/TransferForm.types.ts"),
    readSource("../../features/transfers/components/transfer-form/TransferSidePicker.tsx"),
  ].join("\n");
}

const localQaButtonSource = readSource("../../features/qa/components/LocalQaLoginButton.tsx");
const addChooserSource = readSource("../../app/(tabs)/add.tsx");
const transactionFormSource = readSource(
  "../../features/transactions/components/TransactionForm.tsx"
);
const transferFormSource = readTransferFormSource();

describe("QA selector contract", () => {
  test("exposes a login selector for local QA entry", () => {
    expect(localQaButtonSource).toContain('testID="login.local-qa"');
  });

  test("exposes chooser selectors for transaction and transfer entry", () => {
    expect(addChooserSource).toContain('testID="add-chooser.transaction"');
    expect(addChooserSource).toContain('testID="add-chooser.transfer"');
  });

  test("exposes transaction form selectors for save, date, and account selection", () => {
    expect(transactionFormSource).toContain('testID="transaction-form.save"');
    expect(transactionFormSource).toContain('testID="transaction-form.date"');
    expect(transactionFormSource).toContain("transaction-form.account.");
  });

  test("exposes transfer form selectors for amount, side cards, save, and picker options", () => {
    expect(transferFormSource).toContain('"transfer.form.amount"');
    expect(transferFormSource).toContain('"transfer.form.from-side"');
    expect(transferFormSource).toContain('"transfer.form.to-side"');
    expect(transferFormSource).toContain('"transfer.form.save"');
    expect(transferFormSource).toContain("transfer.picker.account.");
    expect(transferFormSource).toContain('"transfer.picker.outside-fidy"');
  });
});
