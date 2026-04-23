import { expect, test } from "vitest";
import type { Budget } from "@/features/budget";
import {
  resolveBudgetIdParam,
  resolveExistingBudget,
  resolveExistingCategoryIds,
} from "@/features/budget/components/create-budget/CreateBudgetScreen.helpers";

const internetBudget = {
  amount: 100000,
  categoryId: "services",
  createdAt: "2025-01-01T00:00:00.000Z",
  id: "budget-1",
  month: "2025-01",
  updatedAt: "2025-01-01T00:00:00.000Z",
  userId: "user-1",
} as unknown as Budget;

const groceriesBudget = {
  amount: 200000,
  categoryId: "food",
  createdAt: "2025-01-01T00:00:00.000Z",
  id: "budget-2",
  month: "2025-01",
  updatedAt: "2025-01-01T00:00:00.000Z",
  userId: "user-1",
} as unknown as Budget;

test("resolveBudgetIdParam uses the first repeated query param", () => {
  expect(resolveBudgetIdParam(["budget-1", "budget-2"])).toBe("budget-1");
});

test("resolveExistingBudget finds the matching budget", () => {
  expect(resolveExistingBudget([internetBudget, groceriesBudget], "budget-2")).toBe(
    groceriesBudget
  );
});

test("resolveExistingCategoryIds excludes the edited budget category", () => {
  expect(resolveExistingCategoryIds([internetBudget, groceriesBudget], "budget-1")).toEqual(
    new Set(["food"])
  );
});
