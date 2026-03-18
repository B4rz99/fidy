import { describe, expect, it } from "vitest";
import { handleNumpadPress } from "@/features/transactions/lib/handle-numpad-press";

describe("handleNumpadPress", () => {
  it("appends a digit to empty string", () => {
    expect(handleNumpadPress("", "5")).toBe("5");
  });

  it("appends a digit to existing digits", () => {
    expect(handleNumpadPress("12", "3")).toBe("123");
  });

  it("appends 000 to digits", () => {
    expect(handleNumpadPress("5", "000")).toBe("5000");
  });

  it("caps at 11 digits when appending a single digit", () => {
    expect(handleNumpadPress("12345678901", "9")).toBe("12345678901");
  });

  it("caps at 11 digits when appending 000", () => {
    expect(handleNumpadPress("12345678", "000")).toBe("12345678000");
  });

  it("truncates 000 if it would exceed 11 digits", () => {
    expect(handleNumpadPress("1234567890", "000")).toBe("12345678900");
  });

  it("deletes last digit", () => {
    expect(handleNumpadPress("123", "delete")).toBe("12");
  });

  it("returns empty string when deleting last digit", () => {
    expect(handleNumpadPress("1", "delete")).toBe("");
  });

  it("returns empty string when deleting from empty", () => {
    expect(handleNumpadPress("", "delete")).toBe("");
  });

  it("ignores non-digit non-special keys", () => {
    expect(handleNumpadPress("123", "abc")).toBe("123");
  });
});
