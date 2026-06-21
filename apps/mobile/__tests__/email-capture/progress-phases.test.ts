// apps/mobile/__tests__/email-capture/progress-phases.test.ts
import { describe, expect, it } from "vitest";
import {
  isFirstFetchForAny,
  shouldShowProgress,
} from "@/features/email-capture/lib/progress-phases";

describe("shouldShowProgress", () => {
  it("returns true on first fetch regardless of count", () => {
    expect(shouldShowProgress(1, true)).toBe(true);
  });

  it("returns true on first fetch even with 0 emails", () => {
    expect(shouldShowProgress(0, true)).toBe(true);
  });

  it("returns true when email count >= threshold", () => {
    expect(shouldShowProgress(10, false, 5)).toBe(true);
  });

  it("returns false when not first fetch and count < threshold", () => {
    expect(shouldShowProgress(3, false, 5)).toBe(false);
  });

  it("returns true when count equals threshold exactly", () => {
    expect(shouldShowProgress(5, false, 5)).toBe(true);
  });

  it("uses default threshold of 5 when not provided", () => {
    expect(shouldShowProgress(5, false)).toBe(true);
    expect(shouldShowProgress(4, false)).toBe(false);
  });
});

describe("isFirstFetchForAny", () => {
  it("returns true when any account has null lastFetchedAt", () => {
    expect(
      isFirstFetchForAny([{ lastFetchedAt: "2026-03-01T00:00:00Z" }, { lastFetchedAt: null }])
    ).toBe(true);
  });

  it("returns false when all accounts have lastFetchedAt", () => {
    expect(
      isFirstFetchForAny([
        { lastFetchedAt: "2026-03-01T00:00:00Z" },
        { lastFetchedAt: "2026-03-02T00:00:00Z" },
      ])
    ).toBe(false);
  });

  it("returns false for empty accounts array", () => {
    expect(isFirstFetchForAny([])).toBe(false);
  });
});
