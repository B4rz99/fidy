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

  it("caps at 8 digits when appending a single digit", () => {
    expect(handleNumpadPress("12345678", "9")).toBe("12345678");
  });

  it("caps at 8 digits when appending 000", () => {
    expect(handleNumpadPress("123456", "000")).toBe("12345600");
  });

  it("truncates 000 if it would exceed 8 digits", () => {
    expect(handleNumpadPress("1234567", "000")).toBe("12345670");
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
