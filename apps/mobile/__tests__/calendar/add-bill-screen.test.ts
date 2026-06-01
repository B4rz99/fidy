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
  expect(routeSource).toContain('headerBackTitle: ""');
  expect(routeSource).toContain("headerTitle: title");
  expectRouteInRootStackGroup(rootStackRoutesSource, "fullScreen", "add-bill");
  expect(layoutSource).toContain("ROOT_STACK_ROUTES.fullScreen.map");
  expect(layoutSource).toContain("routeOptions.fullScreen");
  expect(layoutSource).not.toContain("formSheet");
});

test("add-bill routes through the extracted screen module", () => {
  expect(routeSource).toContain("AddBillScreen");
  expect(routeSource).toContain("routes.public");
});

test("add-bill content uses KeyboardAvoidingView for keyboard handling", () => {
  expect(formContentSource).toContain("KeyboardAvoidingView");
});

test("add-bill screen keeps keyboard and scroll containers bounded over aurora", () => {
  expect(formContentSource).toContain("style={styles.container}");
  expect(formContentSource).toContain("<AppAuroraBackground");
  expect(formContentSource).not.toContain("styles.title");
  expect(formStylesSource).toContain("container: { flex: 1 }");
});

test("add-bill content has name and amount text inputs", () => {
  expect(formContentSource).toContain("TextInput");
  expect(formContentSource).toContain("onChangeText");
});

test("add-bill content has frequency chips", () => {
  expect(formContentSource).toContain("FREQUENCIES");
  expect(formContentSource).toContain("frequency");
});

test("add-bill content has category chips", () => {
  expect(formContentSource).toContain("CATEGORIES");
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
  expect(routeSource).toContain("useLocalSearchParams");
  expect(routeSource).toContain('t("bills.editBill")');
  expect(routeSource).toContain('t("bills.addBill")');
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

test("add-bill content uses Pressable per ui-pressable rule", () => {
  expect(formContentSource).toContain("Pressable");
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
