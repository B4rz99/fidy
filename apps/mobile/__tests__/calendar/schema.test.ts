import { describe, expect, test } from "vitest";
import {
  billFrequency,
  billPaymentSchema,
  billSchema,
  createBillSchema,
  fromBillRow,
  toBillRow,
} from "@/features/calendar/schema";

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
    categoryId: "services",
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
    categoryId: "services",
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

describe("toBillRow / fromBillRow", () => {
  const bill = {
    id: "bill-1",
    name: "Netflix",
    amountCents: 1599,
    frequency: "monthly" as const,
    categoryId: "services" as const,
    startDate: new Date(2025, 0, 15),
    isActive: true,
  };

  test("toBillRow converts Date to ISO string", () => {
    const row = toBillRow(bill, "user-1", "2026-03-04T10:00:00.000Z");
    expect(typeof row.startDate).toBe("string");
    expect(row.startDate).toBe(new Date(2025, 0, 15).toISOString());
  });

  test("toBillRow adds userId, createdAt, updatedAt from now param", () => {
    const now = "2026-03-04T10:00:00.000Z";
    const row = toBillRow(bill, "user-1", now);
    expect(row.userId).toBe("user-1");
    expect(row.createdAt).toBe(now);
    expect(row.updatedAt).toBe(now);
  });

  test("fromBillRow converts ISO string back to Date", () => {
    const row = toBillRow(bill, "user-1", "2026-03-04T10:00:00.000Z");
    const restored = fromBillRow(row);
    expect(restored.startDate).toBeInstanceOf(Date);
    expect(restored.startDate.getTime()).toBe(bill.startDate.getTime());
  });

  test("roundtrip preserves all bill fields", () => {
    const row = toBillRow(bill, "user-1", "2026-03-04T10:00:00.000Z");
    const restored = fromBillRow(row);
    expect(restored.id).toBe(bill.id);
    expect(restored.name).toBe(bill.name);
    expect(restored.amountCents).toBe(bill.amountCents);
    expect(restored.frequency).toBe(bill.frequency);
    expect(restored.categoryId).toBe(bill.categoryId);
    expect(restored.isActive).toBe(bill.isActive);
  });
});

describe("billPaymentSchema", () => {
  test("accepts valid bill payment", () => {
    const valid = {
      id: "pay-1",
      billId: "bill-1",
      dueDate: "2025-01-15",
      paidAt: "2025-01-14T10:00:00.000Z",
      transactionId: null,
      createdAt: "2025-01-14T10:00:00.000Z",
    };
    expect(billPaymentSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects missing billId", () => {
    const invalid = {
      id: "pay-1",
      dueDate: "2025-01-15",
      paidAt: "2025-01-14T10:00:00.000Z",
      createdAt: "2025-01-14T10:00:00.000Z",
    };
    expect(billPaymentSchema.safeParse(invalid).success).toBe(false);
  });
});
