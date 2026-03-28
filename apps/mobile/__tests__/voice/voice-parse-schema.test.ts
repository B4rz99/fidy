import { describe, expect, it } from "vitest";
import { voiceParseResultSchema } from "@/features/voice/lib/voice-parse-schema";
import type { IsoDate } from "@/shared/types/branded";

describe("voiceParseResultSchema", () => {
  const validExpense = {
    type: "expense" as const,
    amount: 4520,
    categoryId: "food" as const,
    description: "Lunch at restaurant",
    date: "2026-03-15",
  };

  const validIncome = {
    type: "income" as const,
    amount: 100000,
    categoryId: "transfer" as const,
    description: "Monthly salary",
    date: "2026-03-01",
  };

  it("parses valid expense correctly with all fields", () => {
    const result = voiceParseResultSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("expense");
      expect(result.data.amount).toBe(4520);
      expect(result.data.categoryId).toBe("food");
      expect(result.data.description).toBe("Lunch at restaurant");
      expect(result.data.date).toBe("2026-03-15");
    }
  });

  it("parses valid income correctly", () => {
    const result = voiceParseResultSchema.safeParse(validIncome);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("income");
      expect(result.data.amount).toBe(100000);
      expect(result.data.categoryId).toBe("transfer");
    }
  });

  it("fails with invalid categoryId", () => {
    const result = voiceParseResultSchema.safeParse({
      ...validExpense,
      categoryId: "not-a-real-category",
    });
    expect(result.success).toBe(false);
  });

  it("fails with non-integer amount (float)", () => {
    const result = voiceParseResultSchema.safeParse({
      ...validExpense,
      amount: 45.5,
    });
    expect(result.success).toBe(false);
  });

  it("fails with negative amount", () => {
    const result = voiceParseResultSchema.safeParse({
      ...validExpense,
      amount: -100,
    });
    expect(result.success).toBe(false);
  });

  it("fails when type is missing", () => {
    const { type: _, ...withoutType } = validExpense;
    const result = voiceParseResultSchema.safeParse(withoutType);
    expect(result.success).toBe(false);
  });

  it("fails when amount is missing", () => {
    const { amount: _, ...withoutAmount } = validExpense;
    const result = voiceParseResultSchema.safeParse(withoutAmount);
    expect(result.success).toBe(false);
  });

  it("fails when date is missing", () => {
    const { date: _, ...withoutDate } = validExpense;
    const result = voiceParseResultSchema.safeParse(withoutDate);
    expect(result.success).toBe(false);
  });

  it("fails with invalid date format (not YYYY-MM-DD)", () => {
    const result = voiceParseResultSchema.safeParse({
      ...validExpense,
      date: "15-03-2026",
    });
    expect(result.success).toBe(false);
  });

  it("fails with invalid date format (missing dashes)", () => {
    const result = voiceParseResultSchema.safeParse({
      ...validExpense,
      date: "20260315",
    });
    expect(result.success).toBe(false);
  });

  it("transforms date string to IsoDate branded type", () => {
    const result = voiceParseResultSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.date).toBe("string");
      const _typed: IsoDate = result.data.date;
      expect(_typed).toBe("2026-03-15");
    }
  });

  it("fails with zero amount", () => {
    const result = voiceParseResultSchema.safeParse({
      ...validExpense,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });
});
