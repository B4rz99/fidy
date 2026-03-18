import { describe, expect, test } from "vitest";
import { createBudgetSchema } from "@/features/budget/schema";

describe("createBudgetSchema", () => {
  const valid = {
    categoryId: "food",
    amountCents: 50000,
    month: "2026-03",
  };

  test("accepts valid input", () => {
    expect(createBudgetSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects empty categoryId", () => {
    expect(createBudgetSchema.safeParse({ ...valid, categoryId: "" }).success).toBe(false);
  });

  test("rejects invalid categoryId", () => {
    expect(createBudgetSchema.safeParse({ ...valid, categoryId: "invalid-cat" }).success).toBe(
      false
    );
  });

  test("rejects zero amount", () => {
    expect(createBudgetSchema.safeParse({ ...valid, amountCents: 0 }).success).toBe(false);
  });

  test("rejects negative amount", () => {
    expect(createBudgetSchema.safeParse({ ...valid, amountCents: -100 }).success).toBe(false);
  });

  test("rejects non-integer amount", () => {
    expect(createBudgetSchema.safeParse({ ...valid, amountCents: 100.5 }).success).toBe(false);
  });

  test("rejects invalid month format — single digit month", () => {
    expect(createBudgetSchema.safeParse({ ...valid, month: "2026-3" }).success).toBe(false);
  });

  test("rejects invalid month format — word", () => {
    expect(createBudgetSchema.safeParse({ ...valid, month: "march" }).success).toBe(false);
  });

  test("accepts edge month value 2026-01", () => {
    expect(createBudgetSchema.safeParse({ ...valid, month: "2026-01" }).success).toBe(true);
  });

  test("accepts edge month value 2026-12", () => {
    expect(createBudgetSchema.safeParse({ ...valid, month: "2026-12" }).success).toBe(true);
  });

  test("rejects invalid month value 2026-13", () => {
    expect(createBudgetSchema.safeParse({ ...valid, month: "2026-13" }).success).toBe(false);
  });

  test("rejects month 2026-00", () => {
    expect(createBudgetSchema.safeParse({ ...valid, month: "2026-00" }).success).toBe(false);
  });
});
