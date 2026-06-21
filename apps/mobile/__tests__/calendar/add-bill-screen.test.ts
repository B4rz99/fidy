import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { expectRouteInRootStackGroup } from "@/__tests__/helpers/root-stack-routes";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

let routeSource = "";
let layoutSource = "";
let rootStackRoutesSource = "";
let screenSource = "";
let formSource = "";
let formContentSource = "";
let formStylesSource = "";
let authFormSource = "";
let submitSource = "";

beforeAll(() => {
  routeSource = readSource("../../app/add-bill.tsx");
  layoutSource = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
  rootStackRoutesSource = readSource("../../shared/navigation/root-stack-routes.ts");
  screenSource = readSource("../../features/calendar/components/add-bill/AddBillScreen.tsx");
  formSource = readSource("../../features/calendar/components/add-bill/AddBillForm.tsx");
  formContentSource = readSource(
    "../../features/calendar/components/add-bill/AddBillFormContent.tsx"
  );
  formStylesSource = readSource(
    "../../features/calendar/components/add-bill/AddBillForm.styles.ts"
  );
  authFormSource = readSource(
    "../../features/calendar/components/add-bill/AuthenticatedAddBillForm.tsx"
  );
  submitSource = readSource("../../features/calendar/components/add-bill/useAddBillSubmit.ts");
});

test("add-bill is registered in root layout as a full screen route", () => {
  expect(layoutSource).toContain("ROOT_STACK_ROUTES.fullScreen");
  expect(routeSource).not.toContain("DialogRouteFrame");
  expect(routeSource).not.toContain("<Stack.Screen");
  expect(routeSource).not.toContain("headerTitle");
  expectRouteInRootStackGroup(rootStackRoutesSource, "fullScreen", "add-bill");
  expect(layoutSource).toContain("ROOT_STACK_ROUTES.fullScreen.map");
  expect(layoutSource).toContain("routeOptions.fullScreen");
  expect(layoutSource).not.toContain("formSheet");
});

test("add-bill routes through the extracted screen module", () => {
  expect(routeSource).toContain("AddBillScreen");
  expect(routeSource).toContain("routes.public");
});

test("add-bill content uses the shared money-entry screen structure", () => {
  expect(formContentSource).toContain("MoneyEntryScreen");
  expect(formContentSource).toContain("headerTitle={headerTitle}");
  expect(formContentSource).toContain("amountContent={");
  expect(formContentSource).toContain("detailContent={");
  expect(formContentSource).toContain("actionContent={");
  expect(formContentSource).toContain("numpadVisible={numpadActive}");
  expect(formContentSource).toContain("onKeyPress={handleAmountKey}");
  expect(formContentSource).not.toContain("KeyboardAvoidingView");
  expect(formContentSource).not.toContain("<ScrollView");
});

test("add-bill screen delegates aurora and layout bounds to the shared shell", () => {
  expect(formContentSource).not.toContain("<AppAuroraBackground");
  expect(formContentSource).not.toContain("styles.title");
  expect(formStylesSource).not.toContain("container: { flex: 1 }");
});

test("add-bill content has a money-entry name field and amount display", () => {
  expect(formContentSource).toContain("MoneyEntryTextField");
  expect(formContentSource).toContain("MoneyAmountDisplay");
  expect(formContentSource).toContain('emptyDisplay="$0"');
  expect(formContentSource).toContain("setNumpadActive(true)");
  expect(formContentSource).toContain("setNumpadActive(false)");
  expect(formContentSource).not.toContain("<FormTextField");
});

test("add-bill content has frequency chips", () => {
  expect(formContentSource).toContain("FREQUENCIES");
  expect(formContentSource).toContain("frequency");
});

test("add-bill content has category chips", () => {
  expect(formContentSource).toContain("useAvailableCategories");
  expect(formContentSource).toContain("CategoryStrip");
  expect(formContentSource).toContain("category");
});

test("authenticated add-bill form calls addBill from store on submit", () => {
  expect(authFormSource).toContain("addBill");
});

test("add-bill screen uses router.back() on successful save", () => {
  expect(screenSource).toContain("router.back()");
});

test("add-bill screen supports edit mode via billId param", () => {
  expect(screenSource).toContain("billId");
  expect(screenSource).toContain("useLocalSearchParams");
  expect(screenSource).toContain('t("bills.editBill")');
  expect(screenSource).toContain('t("bills.addBill")');
});

test("add-bill submit only closes edit mode after a successful update", () => {
  expect(submitSource).toContain("const success = await onUpdateBill");
  expect(submitSource).toContain("if (success) onDone()");
});

test("authenticated add-bill form gates bill mutations on migration readiness", () => {
  expect(authFormSource).toContain("useMigrations");
  expect(authFormSource).toContain("canSubmit={migrationsReady}");
  expect(authFormSource).toContain("if (!migrationsReady) return Promise.resolve(false)");
  expect(authFormSource).not.toContain("undefined as never");
});

test("add-bill form dismisses keyboard on chip press", () => {
  expect(formSource).toContain("Keyboard.dismiss");
});

test("add-bill form delegates amount digits through handleNumpadPress", () => {
  expect(formSource).toContain("handleNumpadPress");
  expect(formSource).toContain(
    "draftController.setAmount(handleNumpadPress(draftController.draft.amount, key))"
  );
});

test("add-bill content avoids TouchableOpacity per ui-pressable rule", () => {
  expect(formContentSource).not.toContain("TouchableOpacity");
});

test("add-bill date picker uses the shared scrollable calendar sheet", () => {
  expect(formContentSource).toContain("TransactionDatePickerDialog");
  expect(formContentSource).toContain("showDatePicker");
  expect(formContentSource).toContain("setShowDatePicker(true)");
  expect(formContentSource).toContain("allowFuture");
  expect(formContentSource).not.toContain("@react-native-community/datetimepicker");
  expect(formContentSource).not.toContain(
    'display={Platform.OS === "ios" ? "compact" : "default"}'
  );
});
