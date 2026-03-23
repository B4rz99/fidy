import { describe, expect, it } from "vitest";
import { isFirstWeek } from "@/features/notifications/lib/first-week";

const NOW = new Date("2026-03-23T12:00:00.000Z");
const daysAgo = (n: number): string => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("isFirstWeek", () => {
  it("returns true when account is 3 days old", () => {
    expect(isFirstWeek(daysAgo(3), NOW)).toBe(true);
  });

  it("returns false when account is exactly 7 days old", () => {
    expect(isFirstWeek(daysAgo(7), NOW)).toBe(false);
  });

  it("returns false when account is 10 days old", () => {
    expect(isFirstWeek(daysAgo(10), NOW)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isFirstWeek("", NOW)).toBe(false);
  });

  it("returns false for a malformed date string", () => {
    expect(isFirstWeek("not-a-date", NOW)).toBe(false);
  });
});
