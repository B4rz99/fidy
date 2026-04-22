import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

function readTransferFormSource() {
  return {
    content: readSource(
      "../../features/transfers/components/transfer-form/TransferFormContent.tsx"
    ),
    picker: readSource("../../features/transfers/components/transfer-form/TransferSidePicker.tsx"),
  };
}

const localQaButtonSource = readSource("../../features/qa/components/LocalQaLoginButton.tsx");
const addChooserSource = readSource("../../app/(tabs)/add.tsx");
const transactionFormSource = readSource(
  "../../features/transactions/components/TransactionForm.tsx"
);
const transferFormIdsSource = readSource(
  "../../features/transfers/components/transfer-form/TransferForm.types.ts"
);
const transferFormSource = readTransferFormSource();

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

test("wires transfer form selectors through the JSX usage sites", () => {
  expect(transferFormSource.content).toContain("testID={TRANSFER_FORM_TEST_IDS.amount}");
  expect(transferFormSource.content).toContain("testID={TRANSFER_FORM_TEST_IDS.fromSide}");
  expect(transferFormSource.content).toContain("testID={TRANSFER_FORM_TEST_IDS.toSide}");
  expect(transferFormSource.content).toContain("testID={TRANSFER_FORM_TEST_IDS.save}");
  expect(transferFormSource.picker).toContain("TRANSFER_FORM_TEST_IDS.pickerAccountPrefix");
  expect(transferFormSource.picker).toContain("testID={TRANSFER_FORM_TEST_IDS.pickerOutsideFidy}");
});

test("keeps transfer form QA selector literals stable", () => {
  expect(transferFormIdsSource).toContain('amount: "transfer.form.amount"');
  expect(transferFormIdsSource).toContain('fromSide: "transfer.form.from-side"');
  expect(transferFormIdsSource).toContain('toSide: "transfer.form.to-side"');
  expect(transferFormIdsSource).toContain('save: "transfer.form.save"');
  expect(transferFormIdsSource).toContain('pickerAccountPrefix: "transfer.picker.account."');
  expect(transferFormIdsSource).toContain('pickerOutsideFidy: "transfer.picker.outside-fidy"');
});
