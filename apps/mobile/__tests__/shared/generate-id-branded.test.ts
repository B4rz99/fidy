import { describe, expect, expectTypeOf, test } from "vitest";
import { generateBudgetId, generateTransactionId } from "@/shared/lib";
import type { BudgetId, TransactionId } from "@/shared/types/branded";

describe("typed ID generators", () => {
  test("generateTransactionId returns TransactionId", () => {
    const id = generateTransactionId();
    expectTypeOf(id).toEqualTypeOf<TransactionId>();
    expect(id).toMatch(/^txn-/);
  });

  test("generateBudgetId returns BudgetId", () => {
    const id = generateBudgetId();
    expectTypeOf(id).toEqualTypeOf<BudgetId>();
    expect(id).toMatch(/^budget-/);
  });

  test("typed IDs are not interchangeable", () => {
    expectTypeOf<TransactionId>().not.toEqualTypeOf<BudgetId>();
  });
});
