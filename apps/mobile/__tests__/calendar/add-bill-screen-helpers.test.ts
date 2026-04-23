import { describe, expect, test } from "vitest";
import type { Bill } from "@/features/calendar";
import {
  resolveBillIdParam,
  resolveExistingBill,
} from "@/features/calendar/components/add-bill/AddBillScreen.helpers";

const bill = {
  amount: 50000,
  categoryId: "services",
  createdAt: new Date("2025-01-01"),
  frequency: "monthly",
  id: "bill_1",
  name: "Internet",
  startDate: new Date("2025-01-15"),
  updatedAt: new Date("2025-01-01"),
  userId: "user_1",
} as unknown as Bill;

describe("AddBillScreen helpers", () => {
  test("uses the first repeated billId param", () => {
    expect(resolveBillIdParam(["bill_1", "bill_2"])).toBe("bill_1");
  });

  test("passes through a singular billId param", () => {
    expect(resolveBillIdParam("bill_1")).toBe("bill_1");
  });

  test("returns undefined when billId is missing", () => {
    expect(resolveBillIdParam(undefined)).toBeUndefined();
  });

  test("resolves an existing bill from the normalized billId", () => {
    expect(resolveExistingBill([bill], resolveBillIdParam(["bill_1", "bill_2"]))).toBe(bill);
  });
});
