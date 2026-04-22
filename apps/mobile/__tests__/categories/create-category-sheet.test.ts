import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const screenSource = readSource("../../features/categories/components/CreateCategorySheet.tsx");
const contentSource = readSource(
  "../../features/categories/components/category-sheet/CreateCategorySheetContent.tsx"
);
const hookSource = readSource(
  "../../features/categories/components/category-sheet/useCreateCategorySheet.ts"
);
const submitHookSource = readSource(
  "../../features/categories/components/category-sheet/useCreateCategorySubmit.ts"
);

test("keeps CreateCategorySheet routed through extracted category-sheet modules", () => {
  expect(screenSource).toContain("useCreateCategorySheet");
  expect(screenSource).toContain("<CreateCategorySheetContent");
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
