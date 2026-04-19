import { describe, expect, it } from "vitest";
import {
  cleanDigitInput,
  formatInputDisplay,
  formatMoney,
  formatSignedMoney,
  parseDigitsToAmount,
} from "@/shared/lib/format-money";

describe("formatMoney", () => {
  it("formats thousands with dot separator", () => {
    expect(formatMoney(50000)).toBe("$50.000");
  });

  it("formats zero", () => {
    expect(formatMoney(0)).toBe("$0");
  });

  it("formats millions", () => {
    expect(formatMoney(1500000)).toBe("$1.500.000");
  });

  it("formats small amounts without separator", () => {
    expect(formatMoney(500)).toBe("$500");
  });
});

describe("formatSignedMoney", () => {
  it("prepends minus for expenses", () => {
    expect(formatSignedMoney(50000, "expense")).toBe("-$50.000");
  });

  it("prepends plus for income", () => {
    expect(formatSignedMoney(50000, "income")).toBe("+$50.000");
  });
});

describe("parseDigitsToAmount", () => {
  it("parses digit string to number", () => {
    expect(parseDigitsToAmount("50000")).toBe(50000);
  });

  it("returns 0 for empty string", () => {
    expect(parseDigitsToAmount("")).toBe(0);
  });
});

describe("formatInputDisplay", () => {
  it("formats digit string as currency", () => {
    expect(formatInputDisplay("50000")).toBe("$50.000");
  });

  it("formats empty string as zero", () => {
    expect(formatInputDisplay("")).toBe("$0");
  });

  it("strips leading zeros", () => {
    expect(formatInputDisplay("007500")).toBe("$7.500");
  });
});

describe("cleanDigitInput", () => {
  it("strips non-digit characters", () => {
    expect(cleanDigitInput("abc123")).toBe("123");
  });

  it("caps at 11 digits", () => {
    expect(cleanDigitInput("123456789012345")).toBe("12345678901");
  });

  it("returns empty for no digits", () => {
    expect(cleanDigitInput("abc")).toBe("");
  });
});
