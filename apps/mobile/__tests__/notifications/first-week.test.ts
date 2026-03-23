import { describe, expect, it } from "vitest";
import { isFirstWeek } from "@/features/notifications/lib/first-week";

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();

describe("isFirstWeek", () => {
  it("returns true when account is 3 days old", () => {
    expect(isFirstWeek(daysAgo(3), new Date())).toBe(true);
  });

  it("returns false when account is exactly 7 days old", () => {
    expect(isFirstWeek(daysAgo(7), new Date())).toBe(false);
  });

  it("returns false when account is 10 days old", () => {
    expect(isFirstWeek(daysAgo(10), new Date())).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isFirstWeek("", new Date())).toBe(false);
  });

  it("returns false for a malformed date string", () => {
    expect(isFirstWeek("not-a-date", new Date())).toBe(false);
  });
});
