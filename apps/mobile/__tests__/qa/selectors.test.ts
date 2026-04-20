import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("QA selector contract", () => {
  const localQaButtonSource = readFileSync(
    resolve(__dirname, "../../features/qa/components/LocalQaLoginButton.tsx"),
    "utf-8"
  );
  const addChooserSource = readFileSync(resolve(__dirname, "../../app/(tabs)/add.tsx"), "utf-8");
  const transactionFormSource = readFileSync(
    resolve(__dirname, "../../features/transactions/components/TransactionForm.tsx"),
    "utf-8"
  );
  const transferFormSource = readFileSync(
    resolve(__dirname, "../../features/transfers/components/TransferFormScreen.tsx"),
    "utf-8"
  );

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
    expect(transferFormSource).toContain('testID="transfer.form.amount"');
    expect(transferFormSource).toContain('testID="transfer.form.from-side"');
    expect(transferFormSource).toContain('testID="transfer.form.to-side"');
    expect(transferFormSource).toContain('testID="transfer.form.save"');
    expect(transferFormSource).toContain("transfer.picker.account.");
    expect(transferFormSource).toContain('testID="transfer.picker.outside-fidy"');
  });
});
