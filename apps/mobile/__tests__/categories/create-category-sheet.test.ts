import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const screenSource = readSource("../../features/categories/components/CreateCategoryScreen.tsx");
const contentSource = readSource(
  "../../features/categories/components/category-form/CreateCategoryScreenContent.tsx"
);
const hookSource = readSource(
  "../../features/categories/components/category-form/useCreateCategoryScreen.ts"
);
const submitHookSource = readSource(
  "../../features/categories/components/category-form/useCreateCategorySubmit.ts"
);

test("keeps CreateCategoryScreen routed through extracted category-form modules", () => {
  expect(screenSource).toContain("useCreateCategoryScreen");
  expect(screenSource).toContain("<CreateCategoryScreenContent");
});

test("keeps category creation wired to store submission and sheet dismissal", () => {
  expect(hookSource).toContain("useCreateCategorySubmit");
  expect(submitHookSource).toContain("createCustomCategory(getDb(userId), userId, {");
  expect(submitHookSource).toContain("if (success) args.onSuccess();");
});

test("keeps the extracted content wired to icon and color pickers", () => {
  expect(contentSource).toContain("<CategoryIconGrid");
  expect(contentSource).toContain("<CategoryColorSwatches");
  expect(contentSource).toContain('t("categories.create.submit")');
});
