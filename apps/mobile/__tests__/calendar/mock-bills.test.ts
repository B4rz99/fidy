import { describe, expect, test } from "vitest";
import { MOCK_BILLS } from "@/features/calendar/data/mock-bills";
import { billSchema } from "@/features/calendar/schema";

describe("MOCK_BILLS", () => {
  test("is a non-empty array", () => {
    expect(MOCK_BILLS.length).toBeGreaterThan(0);
  });

  test("every bill passes billSchema validation", () => {
    for (const bill of MOCK_BILLS) {
      const result = billSchema.safeParse(bill);
      expect(
        result.success,
        `bill "${bill.name}" failed: ${JSON.stringify(result.error?.issues)}`
      ).toBe(true);
    }
  });

  test("all bill IDs are unique", () => {
    const ids = MOCK_BILLS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all bills are active", () => {
    expect(MOCK_BILLS.every((b) => b.isActive)).toBe(true);
  });

  test("all amounts are positive integers", () => {
    for (const bill of MOCK_BILLS) {
      expect(Number.isInteger(bill.amount)).toBe(true);
      expect(bill.amount).toBeGreaterThan(0);
    }
  });
});
