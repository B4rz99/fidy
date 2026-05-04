import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const addRouteSource = readSource("../../app/(tabs)/add.tsx");
const addTransactionRouteSource = readSource("../../app/add-transaction.tsx");
const addTransferRouteSource = readSource("../../app/add-transfer.tsx");
const transactionEntrySource = readSource(
  "../../features/transactions/components/PencilTransactionEntryScreen.tsx"
);
const transferEntrySource = readSource(
  "../../features/transfers/components/PencilTransferEntryScreen.tsx"
);
const scaffoldSource = readSource("../../shared/components/PencilEntryScaffold.tsx");
const scaffoldStylesSource = readSource("../../shared/components/PencilEntryScaffold.styles.ts");
const transactionSheetsSource = readSource(
  "../../features/transactions/components/PencilTransactionEntrySheets.tsx"
);

test("add transaction routes use the Pencil transaction entry screen from scratch", () => {
  expect(addRouteSource).toContain("PencilTransactionEntryScreen");
  expect(addTransactionRouteSource).toContain("PencilTransactionEntryScreen");
  expect(addRouteSource).not.toContain("TransactionForm");
  expect(addRouteSource).not.toContain("AddEntryCard");
  expect(addRouteSource).not.toContain("addEntry.");
});

test("add transfer route uses the Pencil transfer entry screen", () => {
  expect(addTransferRouteSource).toContain("PencilTransferEntryScreen");
  expect(addTransferRouteSource).not.toContain("TransferFormScreen");
});

test("Pencil entry scaffold matches the requested layout structure", () => {
  expect(scaffoldSource).toContain("PENCIL_ENTRY_ROWS");
  expect(scaffoldSource).toContain("useSafeAreaInsets");
  expect(scaffoldSource).toContain("ANDROID_TAB_BAR_HEIGHT");
  expect(scaffoldSource).toContain("tabBarClearance");
  expect(scaffoldSource).toContain("rightColumn");
  expect(scaffoldSource).toContain("keyConfirm");
  expect(scaffoldSource).toContain("getTabIndicatorColor");
  expect(scaffoldSource).toContain("valueTone");
  expect(scaffoldSource).toContain("amountArea");
  expect(scaffoldSource).toContain("adjustsFontSizeToFit");
  expect(scaffoldSource).toContain("minimumFontScale");
  expect(scaffoldStylesSource).toContain("maxHeight: 252");
  expect(scaffoldSource).toContain("fields");
  expect(scaffoldSource).toContain("bottomSpacer");
  expect(scaffoldSource).toContain("$0");
});

test("Pencil transaction entry supports expense income transfer and calendar", () => {
  expect(transactionEntrySource).toContain("activeTab={type}");
  expect(transactionEntrySource).toContain('entryMode === "transfer"');
  expect(transactionEntrySource).toContain("PencilTransferEntryScreen");
  expect(transactionEntrySource).not.toContain('push("/add-transfer');
  expect(transactionSheetsSource).toContain("DateTimePicker");
  expect(transactionEntrySource).toContain("showAccountPicker");
  expect(transactionEntrySource).toContain("showCategoryPicker");
  expect(transactionSheetsSource).toContain("Modal");
  expect(transactionSheetsSource).toContain("account-picker.backdrop");
  expect(transactionSheetsSource).toContain("calendar-picker.backdrop");
  expect(transactionSheetsSource).toContain("category-picker.backdrop");
  expect(transactionSheetsSource).toContain("accounts.map");
  expect(transactionSheetsSource).toContain("CATEGORIES.map");
  expect(transactionEntrySource).not.toContain("getNextAccountId");
  expect(transactionEntrySource).toContain("saveCurrentTransaction");
});

test("Pencil transfer entry supports transfer side pickers and calendar", () => {
  expect(transferEntrySource).toContain('activeTab="transfer"');
  expect(transferEntrySource).toContain("TransferSidePicker");
  expect(transferEntrySource).toContain('setPickerTarget("from")');
  expect(transferEntrySource).toContain("onTransactionTabSelect");
  expect(transferEntrySource).not.toContain('replace("/add-transaction');
  expect(transferEntrySource).toContain("DateTimePicker");
  expect(transferEntrySource).toContain("showCategoryPicker");
  expect(transferEntrySource).toContain("Modal");
  expect(transferEntrySource).toContain("calendar-picker.backdrop");
  expect(transferEntrySource).toContain("category-picker.backdrop");
});
