import { describe, expect, it } from "vitest";
import {
  amountToCents,
  centsToDisplay,
  cleanDigitInput,
  digitsToCents,
  formatAmount,
  formatCents,
  formatDollars,
  formatSignedAmount,
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

describe("formatCents", () => {
  it("formats cents as currency with no decimals", () => {
    expect(formatCents(6740000)).toBe("$67,400");
  });
});

describe("formatSignedAmount", () => {
  it("returns negative sign for expense", () => {
    expect(formatSignedAmount(6740000, "expense")).toBe("-$67,400");
  });

  it("returns positive sign for income", () => {
    expect(formatSignedAmount(6740000, "income")).toBe("+$67,400");
  });
});

describe("formatDollars", () => {
  it("returns $0 for empty string", () => {
    expect(formatDollars("")).toBe("$0");
  });

  it("formats single digit", () => {
    expect(formatDollars("5")).toBe("$5");
  });

  it("formats with commas", () => {
    expect(formatDollars("10000")).toBe("$10,000");
  });

  it("strips leading zeros", () => {
    expect(formatDollars("007")).toBe("$7");
  });
});

describe("digitsToCents", () => {
  it("converts dollar digits to cents", () => {
    expect(digitsToCents("100")).toBe(10000);
  });

  it("returns 0 for empty string", () => {
    expect(digitsToCents("")).toBe(0);
  });

  it("handles large amounts", () => {
    expect(digitsToCents("10000")).toBe(1000000);
  });
});

describe("cleanDigitInput", () => {
  it("strips non-digit characters", () => {
    expect(cleanDigitInput("abc123def456")).toBe("123456");
  });

  it("caps at 8 digits", () => {
    expect(cleanDigitInput("12345678901")).toBe("12345678");
  });

  it("returns empty string for empty input", () => {
    expect(cleanDigitInput("")).toBe("");
  });
});
