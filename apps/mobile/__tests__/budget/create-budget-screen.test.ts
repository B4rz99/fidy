import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const routeSource = readSource("../../app/create-budget.tsx");
const layoutSource = readSource("../../app/_layout.tsx");
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

test("create-budget is registered in root layout as a dialog modal", () => {
  expect(layoutSource).toContain('"create-budget"');
  expect(routeSource).toContain("DialogRouteFrame");
  const createBudgetBlock = layoutSource.slice(layoutSource.indexOf('name="create-budget"'));
  expect(createBudgetBlock.slice(0, 140)).toContain("DIALOG_MODAL");
  expect(layoutSource).not.toContain("formSheet");
});

test("auto-suggest budgets keeps the scroll view bounded inside the dialog", () => {
  expect(autoSuggestBudgetsSource).toContain("style={styles.flex}");
  expect(autoSuggestBudgetsSource).toContain(
    "style={[styles.container, { backgroundColor: cardBg }]}"
  );
  expect(autoSuggestBudgetsSource).toContain("flex: { flex: 1 }");
  expect(autoSuggestBudgetsSource).toContain("container: { flex: 1 }");
});

test("create-budget route uses the budget public route surface", () => {
  expect(routeSource).toContain("routes.public");
  expect(routeSource).toContain("CreateBudgetScreen");
});

test("create-budget screen supports edit mode via budgetId params", () => {
  expect(screenSource).toContain("budgetId");
  expect(screenSource).toContain("resolveBudgetIdParam");
});

test("create-budget content renders category pills and numpad entry", () => {
  expect(contentSource).toContain("CategoryPill");
  expect(contentSource).toContain("FidyNumpad");
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
