import { describe, expect, it } from "vitest";
import {
  amountToCents,
  centsToDisplay,
  formatAmount,
} from "@/features/transactions/lib/format-amount";

describe("formatAmount", () => {
  it("returns $0.00 for empty string", () => {
    expect(formatAmount("")).toBe("$0.00");
  });

  it("returns $0.00 for zero", () => {
    expect(formatAmount("0")).toBe("$0.00");
  });

  it("formats single digit as cents", () => {
    expect(formatAmount("5")).toBe("$0.05");
  });

  it("formats two digits as cents", () => {
    expect(formatAmount("50")).toBe("$0.50");
  });

  it("formats three digits with dollars and cents", () => {
    expect(formatAmount("520")).toBe("$5.20");
  });

  it("formats a standard amount", () => {
    expect(formatAmount("4520")).toBe("$45.20");
  });

  it("formats large amounts with commas", () => {
    expect(formatAmount("1234567")).toBe("$12,345.67");
  });

  it("strips non-numeric characters", () => {
    expect(formatAmount("45a2b0")).toBe("$45.20");
  });

  it("handles leading zeros", () => {
    expect(formatAmount("0050")).toBe("$0.50");
  });
});

describe("amountToCents", () => {
  it("converts formatted string to cents", () => {
    expect(amountToCents("$45.20")).toBe(4520);
  });

  it("returns 0 for empty string", () => {
    expect(amountToCents("")).toBe(0);
  });

  it("handles large amounts with commas", () => {
    expect(amountToCents("$12,345.67")).toBe(1234567);
  });
});

describe("centsToDisplay", () => {
  it("converts cents to display string", () => {
    expect(centsToDisplay(4520)).toBe("$45.20");
  });

  it("handles zero", () => {
    expect(centsToDisplay(0)).toBe("$0.00");
  });

  it("handles single-digit cents", () => {
    expect(centsToDisplay(5)).toBe("$0.05");
  });
});
