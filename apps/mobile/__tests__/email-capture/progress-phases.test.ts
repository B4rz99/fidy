// apps/mobile/__tests__/email-capture/progress-phases.test.ts
import { describe, expect, it } from "vitest";
import {
  buildProgressDisplay,
  isFirstFetchForAny,
  shouldMorphToBanner,
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

describe("buildProgressDisplay", () => {
  const makeT = async () => {
    const { default: i18n } = await import("@/shared/i18n/i18n");
    i18n.locale = "en";
    return i18n.t.bind(i18n) as (key: string, options?: Record<string, unknown>) => string;
  };

  it("builds fetching display with generic subtitle", async () => {
    const t = await makeT();
    const display = buildProgressDisplay("fetching", null, ["gmail"], t);
    expect(display).toEqual({
      phase: "fetching",
      title: "Fetching your emails...",
      subtitle: "Reading the last 30 days",
      fractionComplete: 0,
      transactionsFound: 0,
      needsReview: 0,
    });
  });

  it("builds processing display with fraction and counts", async () => {
    const t = await makeT();
    const display = buildProgressDisplay(
      "processing",
      { total: 20, completed: 10, saved: 3, failed: 1, needsReview: 2 },
      ["gmail"],
      t
    );
    expect(display).toEqual({
      phase: "processing",
      title: "Scanning emails...",
      subtitle: "10 of 20",
      fractionComplete: 0.5,
      transactionsFound: 3,
      needsReview: 2,
    });
  });

  it("builds processing display with zero total (fraction = 0)", async () => {
    const t = await makeT();
    const display = buildProgressDisplay(
      "processing",
      { total: 0, completed: 0, saved: 0, failed: 0, needsReview: 0 },
      ["gmail"],
      t
    );
    expect(display.fractionComplete).toBe(0);
  });

  it("builds complete display with saved count and total", async () => {
    const t = await makeT();
    const display = buildProgressDisplay(
      "complete",
      { total: 28, completed: 28, saved: 8, failed: 0, needsReview: 2 },
      ["gmail"],
      t
    );
    expect(display).toEqual({
      phase: "complete",
      title: "Import complete!",
      subtitle: "Found 8 transactions from 28 emails",
      fractionComplete: 1,
      transactionsFound: 8,
      needsReview: 2,
    });
  });

  it("appends failed count to complete subtitle when failed > 0", async () => {
    const t = await makeT();
    const display = buildProgressDisplay(
      "complete",
      { total: 28, completed: 28, saved: 8, failed: 3, needsReview: 0 },
      ["gmail"],
      t
    );
    expect(display.subtitle).toBe("Found 8 transactions from 28 emails (3 couldn't be read)");
  });

  it("includes needsReview count in complete display", async () => {
    const t = await makeT();
    const display = buildProgressDisplay(
      "complete",
      { total: 10, completed: 10, saved: 5, failed: 0, needsReview: 3 },
      ["gmail"],
      t
    );
    expect(display.needsReview).toBe(3);
  });
});

describe("shouldMorphToBanner", () => {
  it("returns true when needsReview > 0", () => {
    expect(shouldMorphToBanner(3)).toBe(true);
  });

  it("returns false when needsReview is 0", () => {
    expect(shouldMorphToBanner(0)).toBe(false);
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
