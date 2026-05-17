import { describe, expect, it } from "vitest";
import { normalizeTransactionSource } from "@/shared/lib/transaction-source";

describe("normalizeTransactionSource", () => {
  it("preserves valid closed transaction sources", () => {
    expect(normalizeTransactionSource("manual")).toBe("manual");
    expect(normalizeTransactionSource("email_capture")).toBe("email_capture");
    expect(normalizeTransactionSource("notification_capture")).toBe("notification_capture");
    expect(normalizeTransactionSource("widget_capture")).toBe("widget_capture");
    expect(normalizeTransactionSource("apple_pay_capture")).toBe("apple_pay_capture");
  });

  it("defaults missing sources to manual", () => {
    expect(normalizeTransactionSource(null)).toBe("manual");
    expect(normalizeTransactionSource(undefined)).toBe("manual");
  });

  it("rejects non-transaction source identifiers", () => {
    expect(() => normalizeTransactionSource("email_gmail")).toThrow(
      "Unsupported transaction source: email_gmail"
    );
  });
});
