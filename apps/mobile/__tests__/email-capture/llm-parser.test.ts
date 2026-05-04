import { describe, expect, it } from "vitest";
import { llmOutputSchema } from "@/features/email-capture/services/llm-parser";

const validTransaction = {
  type: "expense",
  amount: 50000,
  categoryId: "food",
  description: "Exito",
  date: "2026-03-05",
  confidence: 0.9,
};

describe("llmOutputSchema", () => {
  it("accepts expense and income transaction types", () => {
    expect(llmOutputSchema.safeParse(validTransaction).success).toBe(true);
    expect(llmOutputSchema.safeParse({ ...validTransaction, type: "income" }).success).toBe(true);
  });

  it("rejects empty transaction types", () => {
    expect(llmOutputSchema.safeParse({ ...validTransaction, type: "" }).success).toBe(false);
  });

  it("requires an exact ISO calendar date", () => {
    expect(llmOutputSchema.safeParse({ ...validTransaction, date: "x2026-03-05" }).success).toBe(
      false
    );
    expect(llmOutputSchema.safeParse({ ...validTransaction, date: "2026-03-05x" }).success).toBe(
      false
    );
  });
});
