import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const routeSource = readSource("../../app/add-bill.tsx");
const layoutSource = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
const screenSource = readSource("../../features/calendar/components/add-bill/AddBillScreen.tsx");
const formSource = readSource("../../features/calendar/components/add-bill/AddBillForm.tsx");
const formContentSource = readSource(
  "../../features/calendar/components/add-bill/AddBillFormContent.tsx"
);
const authFormSource = readSource(
  "../../features/calendar/components/add-bill/AuthenticatedAddBillForm.tsx"
);
const submitSource = readSource("../../features/calendar/components/add-bill/useAddBillSubmit.ts");

test("add-bill is registered in root layout as formSheet", () => {
  expect(layoutSource).toContain('name="add-bill"');
  expect(layoutSource).toContain("formSheet");
});

test("add-bill routes through the extracted screen module", () => {
  expect(routeSource).toContain("AddBillScreen");
  expect(routeSource).toContain("routes.public");
});

test("add-bill content uses KeyboardAvoidingView for keyboard handling", () => {
  expect(formContentSource).toContain("KeyboardAvoidingView");
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
