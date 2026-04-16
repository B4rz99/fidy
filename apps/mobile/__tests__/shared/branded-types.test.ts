import { assertType, describe, expectTypeOf, test } from "vitest";
import type {
  AccountId,
  Brand,
  BudgetId,
  CopAmount,
  IsoDate,
  Month,
  TransactionId,
} from "@/shared/types/branded";

describe("branded types", () => {
  test("TransactionId is not assignable to BudgetId", () => {
    expectTypeOf<TransactionId>().not.toEqualTypeOf<BudgetId>();
  });

  test("BudgetId is not assignable to TransactionId", () => {
    expectTypeOf<BudgetId>().not.toEqualTypeOf<TransactionId>();
  });

  test("AccountId is not assignable to TransactionId", () => {
    expectTypeOf<AccountId>().not.toEqualTypeOf<TransactionId>();
  });

  test("plain string is not assignable to TransactionId", () => {
    expectTypeOf<string>().not.toMatchTypeOf<TransactionId>();
  });

  test("TransactionId is assignable to string", () => {
    expectTypeOf<TransactionId>().toMatchTypeOf<string>();
  });

  test("Month is not assignable to IsoDate", () => {
    expectTypeOf<Month>().not.toEqualTypeOf<IsoDate>();
  });

  test("CopAmount is not assignable to plain number", () => {
    assertType<CopAmount>(42 as CopAmount);
    expectTypeOf<number>().not.toMatchTypeOf<CopAmount>();
  });

  test("branded types preserve the underlying type", () => {
    expectTypeOf<TransactionId>().toMatchTypeOf<string>();
    expectTypeOf<CopAmount>().toMatchTypeOf<number>();
  });

  test("Brand utility produces distinct types for different brands", () => {
    type A = Brand<string, "A">;
    type B = Brand<string, "B">;
    expectTypeOf<A>().not.toEqualTypeOf<B>();
  });
});
