import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { expectTitledRouteExtendsFullScreen } from "@/__tests__/helpers/root-stack-routes";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const routeSource = readSource("../../app/create-budget.tsx");
const layoutSource = readSource("../../app/_layout.tsx");
const rootStackRoutesSource = readSource("../../shared/navigation/root-stack-routes.ts");
const autoSuggestBudgetsSource = readSource("../../app/auto-suggest-budgets.tsx");
const screenSource = readSource(
  "../../features/budget/components/create-budget/CreateBudgetScreen.tsx"
);
const formSource = readSource(
  "../../features/budget/components/create-budget/CreateBudgetForm.tsx"
);
const contentSource = readSource(
  "../../features/budget/components/create-budget/CreateBudgetFormContent.tsx"
);
const authSource = readSource(
  "../../features/budget/components/create-budget/AuthenticatedCreateBudgetForm.tsx"
);
const submitSource = readSource(
  "../../features/budget/components/create-budget/useCreateBudgetSubmit.ts"
);

test("create-budget is registered in root layout as a full screen route", () => {
  expect(layoutSource).toContain('"create-budget"');
  expect(routeSource).not.toContain("DialogRouteFrame");
  expect(routeSource).toContain("CreateBudgetScreen");
  expect(layoutSource).toContain('name="create-budget"');
  expect(layoutSource).toContain("routeOptions.titled.createBudget");
  expect(rootStackRoutesSource).toContain("createBudget");
  expectTitledRouteExtendsFullScreen(rootStackRoutesSource, "createBudget");
  expect(layoutSource).not.toContain("formSheet");
});

test("auto-suggest budgets keeps the scroll view bounded inside the full screen route", () => {
  expect(autoSuggestBudgetsSource).toContain("<AppAuroraBackground");
  expect(autoSuggestBudgetsSource).toContain("style={styles.flex}");
  expect(autoSuggestBudgetsSource).not.toContain("backgroundColor: pageBg");
  expect(autoSuggestBudgetsSource).toContain("style={styles.container}");
  expect(autoSuggestBudgetsSource).toContain("flex: { flex: 1 }");
  expect(autoSuggestBudgetsSource).toContain("container: { flex: 1 }");
});

test("create-budget route uses the budget public route surface", () => {
  expect(routeSource).toContain("routes.public");
  expect(routeSource).toContain("CreateBudgetScreen");
  expect(routeSource).toContain('headerBackButtonDisplayMode: "minimal"');
  expect(routeSource).toContain('headerBackTitle: ""');
  expect(routeSource).toContain("headerBackVisible: false");
  expect(routeSource).toContain(
    'budgetId != null ? t("budgets.edit.title") : t("budgets.create.title")'
  );
});

test("create-budget screen supports edit mode via budgetId params", () => {
  expect(screenSource).toContain("budgetId");
  expect(screenSource).toContain("resolveBudgetIdParam");
});

test("create-budget content renders category pills and numpad entry", () => {
  expect(contentSource).toContain("CategoryPill");
  expect(contentSource).toContain("MoneyEntryScreen");
  expect(contentSource).toContain("ChoiceTray");
  expect(contentSource).toContain("actionContent={");
  expect(contentSource).toContain("amountContent={");
  expect(contentSource).toContain('t("budgets.create.lastMonthHint"');
  expect(contentSource).not.toContain('t("budgets.create.enterAmount")');
  expect(contentSource).not.toContain('t("budgets.create.title")');
});

test("create-budget form delegates numpad digits through handleNumpadPress", () => {
  expect(formSource).toContain("handleNumpadPress");
  expect(formSource).toContain(
    "setDigits((currentDigits) => handleNumpadPress(currentDigits, key))"
  );
});

test("authenticated create-budget form writes through budget store actions", () => {
  expect(authSource).toContain("createBudget");
  expect(authSource).toContain("updateBudget");
  expect(authSource).toContain("deleteBudget");
});

test("create-budget submit only closes after successful mutations", () => {
  expect(submitSource).toContain("if (success) onDone()");
});
