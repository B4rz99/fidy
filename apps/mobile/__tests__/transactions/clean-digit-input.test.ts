import { describe, expect, it } from "vitest";
import { cleanDigitInput } from "@/features/transactions/lib/format-amount";

describe("cleanDigitInput", () => {
  it("passes through plain digits unchanged", () => {
    expect(cleanDigitInput("12345")).toBe("12345");
  });

  it("strips non-digit characters", () => {
    expect(cleanDigitInput("$1,234.56")).toBe("123456");
  });

  it("strips letters and symbols", () => {
    expect(cleanDigitInput("abc!@#123")).toBe("123");
  });

  it("limits output to 8 digits", () => {
    expect(cleanDigitInput("123456789")).toBe("12345678");
  });

  it("returns empty string for empty input", () => {
    expect(cleanDigitInput("")).toBe("");
  });

  it("returns empty string for non-digit-only input", () => {
    expect(cleanDigitInput("abc")).toBe("");
  });

  it("strips then limits combined", () => {
    expect(cleanDigitInput("a1b2c3d4e5f6g7h8i9")).toBe("12345678");
  });
});
