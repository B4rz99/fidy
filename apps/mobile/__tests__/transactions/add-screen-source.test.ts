import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const addRouteSource = readSource("../../app/(tabs)/add/index.tsx");
const addTransactionRouteSource = readSource("../../app/add-transaction.tsx");
const addTransferRouteSource = readSource("../../app/add-transfer.tsx");
const transactionEntrySource = readSource(
  "../../features/transactions/components/TransactionEntryScreen.tsx"
);
const transferEntryContentSource = readSource(
  "../../features/transfers/components/TransferEntryContent.tsx"
);
const transferEntrySource = readSource(
  "../../features/transfers/components/TransferEntryScreen.tsx"
);
const scaffoldSource = readSource("../../shared/components/EntryScaffold.tsx");
const entryFieldSource = readSource("../../shared/components/EntryField.tsx");
const scaffoldStylesSource = readSource("../../shared/components/EntryScaffold.styles.ts");
const transactionPickersSource = readSource(
  "../../features/transactions/components/TransactionEntryPickers.tsx"
);
const transferSidePickerSource = readSource(
  "../../features/transfers/components/transfer-form/TransferSidePicker.tsx"
);
const sharedDialogSource = readSource("../../shared/components/DialogFrame.tsx");
const sharedDatePickerDialogSource = readSource("../../shared/components/DatePickerDialog.tsx");
const themeSource = readSource("../../shared/constants/theme.ts");

test("add transaction routes use the Transaction entry screen from scratch", () => {
  expect(addRouteSource).toContain("TransactionEntryScreen");
  expect(addTransactionRouteSource).toContain("TransactionEntryScreen");
  expect(addRouteSource).not.toContain("TransactionForm");
  expect(addRouteSource).not.toContain("AddEntryCard");
  expect(addRouteSource).not.toContain("addEntry.");
});

test("add transfer route uses the Transfer entry screen", () => {
  expect(addTransferRouteSource).toContain("TransferEntryScreen");
  expect(addTransferRouteSource).not.toContain("TransferFormScreen");
});

test("Entry scaffold matches the requested layout structure", () => {
  expect(scaffoldSource).toContain("ENTRY_ROWS");
  expect(scaffoldSource).toContain("useSafeAreaInsets");
  expect(scaffoldSource).toContain("ANDROID_TAB_BAR_HEIGHT");
  expect(scaffoldSource).toContain("tabBarClearance");
  expect(scaffoldSource).toContain("rightColumn");
  expect(scaffoldSource).toContain("keyConfirm");
  expect(scaffoldSource).toContain("getTabIndicatorColor");
  expect(scaffoldSource).toContain("GestureDetector");
  expect(scaffoldSource).toContain("SWIPE_TAB_THRESHOLD");
  expect(scaffoldSource).toContain("onTabPress(nextTab.key)");
  expect(scaffoldSource).toContain("onTabPress(previousTab.key)");
  expect(scaffoldSource).toContain("Animated.View");
  expect(scaffoldSource).toContain("withTiming");
  expect(scaffoldSource).toContain("useDerivedValue");
  expect(scaffoldSource).toContain("animatedTabPillStyle");
  expect(scaffoldSource).toContain("animatedTabPillX");
  expect(scaffoldSource).toContain("animatedTabPillColor");
  expect(scaffoldStylesSource).toContain("tabPill");
  expect(scaffoldStylesSource).not.toContain("tabLine");
  expect(scaffoldSource).toContain("useWindowDimensions");
  expect(scaffoldSource).toContain("ENTRY_HORIZONTAL_PADDING");
  expect(scaffoldSource).toContain("TAB_GAP");
  expect(entryFieldSource).toContain("valueTone");
  expect(scaffoldSource).toContain("amountArea");
  expect(scaffoldSource).toContain("adjustsFontSizeToFit");
  expect(scaffoldSource).toContain("minimumFontScale");
  expect(scaffoldStylesSource).toContain("maxHeight: 252");
  expect(scaffoldSource).toContain("fields");
  expect(scaffoldSource).toContain("$0");
});

test("Entry numpad keeps the final row aligned to three columns", () => {
  expect(scaffoldSource).toContain('["000", "0", "delete"]');
  expect(scaffoldSource).toContain("<View key={key} style={styles.rightColumn}>");
  expect(scaffoldSource).not.toContain("style={({ pressed })");
  expect(scaffoldStylesSource).toContain("rightColumn: {");
  expect(scaffoldStylesSource).toContain("flex: 1");
  expect(scaffoldStylesSource).not.toContain("flex: 2");
  expect(scaffoldStylesSource).not.toContain("flexBasis");
  expect(scaffoldStylesSource).not.toContain("minWidth");
});

test("Entry numpad feedback does not own layout styles", () => {
  expect(scaffoldSource).toContain("EntryNumpadButton");
  expect(scaffoldSource).toContain("Haptics.impactAsync");
  expect(scaffoldSource).toContain("android_ripple");
  expect(scaffoldSource).toContain("styles.keyFeedback");
  expect(scaffoldStylesSource).toContain("keyFeedback");
  expect(scaffoldStylesSource).not.toContain("keyPressed");
});

test("Entry tab indicator uses a centered pill instead of an underline", () => {
  expect(scaffoldSource).toContain("animatedTabPillStyle");
  expect(scaffoldSource).toContain("animatedTabPillX");
  expect(scaffoldSource).toContain("animatedTabPillColor");
  expect(scaffoldSource).toContain("tabPillWidth");
  expect(scaffoldSource).toContain("totalTabGap");
  expect(scaffoldSource).toContain("transform: [{ translateX: animatedTabPillX.value }]");
  expect(scaffoldSource).toContain("{ width: tabPillWidth }");
  expect(scaffoldSource).not.toContain("scaleX");
  expect(scaffoldSource).not.toContain("TAB_LINE_WIDTH");
  expect(scaffoldStylesSource).toContain("tabPill");
  expect(scaffoldStylesSource).toContain("top: 2");
  expect(scaffoldStylesSource).toContain("height: 30");
  expect(scaffoldStylesSource).toContain("borderRadius: 999");
  expect(scaffoldStylesSource).toContain("height: 34");
  expect(scaffoldStylesSource).not.toContain("tabLine");
});

test("Entry bottom spacing keeps the numpad close to the floating tab bar", () => {
  expect(scaffoldSource).toContain('Platform.OS === "ios" ? ANDROID_TAB_BAR_HEIGHT / 8');
  expect(scaffoldSource).toContain("tabBarHeight + Math.max(bottom, 16)");
  expect(scaffoldStylesSource).not.toContain("bottomSpacer");
  expect(scaffoldStylesSource).not.toContain("maxHeight: 256");
});

test("Entry dismisses the description keyboard from outside taps", () => {
  expect(scaffoldSource).toContain("Keyboard");
  expect(scaffoldSource).toContain("onPress={Keyboard.dismiss}");
  expect(scaffoldSource).not.toContain("onTouchStart={Keyboard.dismiss}");
});

test("Entry picker backdrops are translucent and do not slide the screen", () => {
  expect(themeSource).toContain('modalBackdrop: "#000000"');
  expect(sharedDialogSource).toContain("backgroundColor: `${modalBackdrop}40`");
  expect(sharedDialogSource).toContain('justifyContent: "center"');
  expect(sharedDialogSource).toContain("maxWidth: 480");
  expect(sharedDialogSource).toContain('animationType="fade"');
  expect(transferSidePickerSource).not.toContain('animationType="slide"');
  expect(transferSidePickerSource).toContain("PickerDialog");
  expect(transferSidePickerSource).not.toContain("DialogFrame");
  expect(transferSidePickerSource).not.toContain("DialogPanel");
});

test("Transaction entry supports expense income transfer and calendar", () => {
  expect(transactionEntrySource).toContain("activeTab={activeTab}");
  expect(transactionEntrySource).toContain('uiState.entryMode === "transfer"');
  expect(transactionEntrySource).not.toContain("TransferEntryScreen");
  expect(transactionEntrySource).toContain("useTransferEntry");
  expect(transferEntryContentSource).toContain("useTransferForm");
  expect(transactionEntrySource).not.toContain('push("/add-transfer');
  expect(transactionPickersSource).toContain("TransactionDatePickerDialog");
  expect(transactionEntrySource).toContain('uiState.picker === "account"');
  expect(transactionEntrySource).toContain('uiState.picker === "category"');
  expect(transactionPickersSource).toContain("Modal");
  expect(transactionPickersSource).toContain("account-picker.backdrop");
  expect(transactionPickersSource).toContain("calendar-picker.backdrop");
  expect(transactionPickersSource).toContain("category-picker.backdrop");
  expect(transactionPickersSource).toContain("accounts.map");
  expect(transactionPickersSource).toContain("CATEGORIES.map");
  expect(transactionEntrySource).not.toContain("getNextAccountId");
  expect(transactionEntrySource).toContain("saveCurrentTransaction");
});

test("Transaction entry confirms saves with a toast without leaving the add screen", () => {
  expect(transactionEntrySource).toContain("showSuccessToast");
  expect(transactionEntrySource).toContain('showSuccessToast(t("transactions.saved"), 1.6)');
  expect(transferEntryContentSource).toContain('showSuccessToast(t("transfers.saved"), 1.6)');
  expect(transactionEntrySource).not.toContain('navigate("/(tabs)"');
  expect(transferEntryContentSource).not.toContain('navigate("/(tabs)"');
});

test("Add screens do not allow future transaction dates", () => {
  expect(sharedDatePickerDialogSource).toContain("useCurrentDate");
  expect(sharedDatePickerDialogSource).toContain("allowFuture");
  expect(transactionPickersSource).toContain("TransactionDatePickerDialog");
  expect(transferEntryContentSource).toContain("DatePickerDialog");
});

test("Transfer entry supports transfer side pickers and calendar", () => {
  expect(transferEntrySource).toContain('activeTab="transfer"');
  expect(transferEntrySource).toContain("useTransferEntry");
  expect(transferEntryContentSource).toContain("TransferSidePicker");
  expect(transferEntryContentSource).toContain('setPickerTarget("from")');
  expect(transferEntrySource).toContain("onTransactionTabSelect");
  expect(transferEntrySource).not.toContain('replace("/add-transaction');
  expect(transferEntryContentSource).toContain("DatePickerDialog");
  expect(transferEntryContentSource).toContain("showCategoryPicker");
  expect(transferEntryContentSource).toContain("DialogFrame");
  expect(transferEntryContentSource).toContain("DialogPanel");
  expect(transferEntryContentSource).toContain("PickerOptionRow");
  expect(sharedDatePickerDialogSource).toContain("calendar-picker.backdrop");
  expect(transferEntryContentSource).toContain("category-picker.backdrop");
});
