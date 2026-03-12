import { beforeEach, describe, expect, it, vi } from "vitest";

describe("getDateLabel", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 'Today, ...' when date equals now", async () => {
    vi.doMock("date-fns", () => ({
      format: () => "Mar 2, 2026",
      isSameDay: () => true,
    }));
    const { getDateLabel } = await import("@/features/transactions/lib/format-date");
    const now = new Date("2026-03-02");
    expect(getDateLabel(now, now)).toBe("Today, Mar 2, 2026");
  });

  it("returns plain date when not today", async () => {
    vi.doMock("date-fns", () => ({
      format: () => "Feb 28, 2026",
      isSameDay: () => false,
    }));
    const { getDateLabel } = await import("@/features/transactions/lib/format-date");
    const now = new Date("2026-03-02");
    expect(getDateLabel(new Date("2026-02-28"), now)).toBe("Feb 28, 2026");
  });
});
