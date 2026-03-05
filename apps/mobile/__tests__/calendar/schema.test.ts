import { describe, expect, test } from "vitest";
import { billFrequency, billSchema, createBillSchema } from "@/features/calendar/schema";

describe("billFrequency", () => {
  test.each(["weekly", "biweekly", "monthly", "yearly"])("accepts '%s'", (f) => {
    expect(billFrequency.safeParse(f).success).toBe(true);
  });

  test("rejects invalid frequency", () => {
    expect(billFrequency.safeParse("daily").success).toBe(false);
  });
});

describe("billSchema", () => {
  const valid = {
    id: "bill-1",
    name: "Netflix",
    amountCents: 1599,
    frequency: "monthly",
    categoryId: "bills",
    startDate: new Date(2025, 0, 15),
    isActive: true,
  };

  test("accepts valid bill", () => {
    expect(billSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects empty name", () => {
    expect(billSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  test("rejects zero amount", () => {
    expect(billSchema.safeParse({ ...valid, amountCents: 0 }).success).toBe(false);
  });

  test("rejects negative amount", () => {
    expect(billSchema.safeParse({ ...valid, amountCents: -100 }).success).toBe(false);
  });

  test("rejects non-integer amount", () => {
    expect(billSchema.safeParse({ ...valid, amountCents: 15.99 }).success).toBe(false);
  });

  test("rejects invalid categoryId", () => {
    expect(billSchema.safeParse({ ...valid, categoryId: "invalid" }).success).toBe(false);
  });

  test("rejects non-date startDate", () => {
    expect(billSchema.safeParse({ ...valid, startDate: "2025-01-15" }).success).toBe(false);
  });
});

describe("createBillSchema", () => {
  const valid = {
    name: "Netflix",
    amountCents: 1599,
    frequency: "monthly",
    categoryId: "bills",
    startDate: new Date(2025, 0, 15),
    isActive: true,
  };

  test("accepts valid input without id", () => {
    expect(createBillSchema.safeParse(valid).success).toBe(true);
  });

  test("strips id field from parsed output", () => {
    const result = createBillSchema.safeParse({ ...valid, id: "bill-1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("id" in result.data).toBe(false);
    }
  });

  test("rejects invalid frequency", () => {
    expect(createBillSchema.safeParse({ ...valid, frequency: "daily" }).success).toBe(false);
  });

  test("rejects invalid categoryId", () => {
    expect(createBillSchema.safeParse({ ...valid, categoryId: "invalid" }).success).toBe(false);
  });
});
