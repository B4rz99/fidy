import { describe, expect, it } from "vitest";
import { chatActionSchema } from "@/features/ai-chat/schema";

describe("chatActionSchema", () => {
  it("returns a validation error for impossible ISO dates instead of throwing", () => {
    expect(() =>
      chatActionSchema.safeParse({
        type: "add",
        data: {
          type: "expense",
          amount: 10000,
          categoryId: "food",
          description: "Lunch",
          date: "2026-02-31",
        },
      })
    ).not.toThrow();

    const result = chatActionSchema.safeParse({
      type: "add",
      data: {
        type: "expense",
        amount: 10000,
        categoryId: "food",
        description: "Lunch",
        date: "2026-02-31",
      },
    });

    expect(result.success).toBe(false);
  });

  it("returns a validation error for whitespace transaction ids instead of throwing", () => {
    expect(() =>
      chatActionSchema.safeParse({
        type: "delete",
        transactionId: "   ",
        description: "Uber",
        amount: 15000,
        date: "2026-03-01",
      })
    ).not.toThrow();

    const result = chatActionSchema.safeParse({
      type: "delete",
      transactionId: "   ",
      description: "Uber",
      amount: 15000,
      date: "2026-03-01",
    });

    expect(result.success).toBe(false);
  });
});
