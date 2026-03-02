import { beforeEach, describe, expect, it, vi } from "vitest";

describe("getDateLabel", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 'Today, ...' when date is today", async () => {
    vi.doMock("date-fns", () => ({
      format: () => "Mar 2, 2026",
      isToday: () => true,
    }));
    const { getDateLabel } = await import("@/features/transactions/lib/format-date");
    expect(getDateLabel(new Date())).toBe("Today, Mar 2, 2026");
  });

  it("returns plain date when not today", async () => {
    vi.doMock("date-fns", () => ({
      format: () => "Feb 28, 2026",
      isToday: () => false,
    }));
    const { getDateLabel } = await import("@/features/transactions/lib/format-date");
    expect(getDateLabel(new Date("2026-02-28"))).toBe("Feb 28, 2026");
  });
});
