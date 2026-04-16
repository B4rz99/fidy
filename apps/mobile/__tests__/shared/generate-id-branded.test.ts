import { describe, expect, expectTypeOf, test } from "vitest";
import { generateAccountId, generateBudgetId, generateTransactionId } from "@/shared/lib";
import type { AccountId, BudgetId, TransactionId } from "@/shared/types/branded";

describe("typed ID generators", () => {
  test("generateAccountId returns AccountId", () => {
    const id = generateAccountId();
    expectTypeOf(id).toEqualTypeOf<AccountId>();
    expect(id).toMatch(/^acct-/);
  });

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
