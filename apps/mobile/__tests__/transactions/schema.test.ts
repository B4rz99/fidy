import { describe, expect, it } from "vitest";
import { createTransactionSchema } from "@/features/transactions/schema";

describe("createTransactionSchema", () => {
  const validInput = {
    type: "expense" as const,
    amount: 4520,
    categoryId: "food" as const,
    description: "Groceries",
    date: new Date("2026-03-01"),
  };

  it("accepts valid expense input", () => {
    const result = createTransactionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts valid income input", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      type: "income",
      categoryId: "other",
    });
    expect(result.success).toBe(true);
  });

  it("accepts input without description", () => {
    const { description: _, ...withoutDesc } = validInput;
    const result = createTransactionSchema.safeParse(withoutDesc);
    expect(result.success).toBe(true);
  });

  it("rejects zero amount", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      amount: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects fractional amount", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      amount: 45.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      type: "transfer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      categoryId: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("rejects transfer as a transaction category", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      categoryId: "transfer",
    });
    expect(result.success).toBe(false);
  });

  it("trims description whitespace", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      description: "  Groceries  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Groceries");
    }
  });

  it("rejects description over 200 chars", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      description: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});
