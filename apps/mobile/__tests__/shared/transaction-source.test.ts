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

  it("normalizes legacy automated aliases into closed source categories", () => {
    expect(normalizeTransactionSource("automated")).toBe("email_capture");
    expect(normalizeTransactionSource("email_gmail")).toBe("email_capture");
    expect(normalizeTransactionSource("notification_android")).toBe("notification_capture");
    expect(normalizeTransactionSource("google_pay")).toBe("notification_capture");
    expect(normalizeTransactionSource("widget")).toBe("widget_capture");
    expect(normalizeTransactionSource("apple_pay")).toBe("apple_pay_capture");
  });
});
