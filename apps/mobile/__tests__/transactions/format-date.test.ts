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
    expect(getDateLabel({ date: now, now, todayLabel: "Today" })).toBe("Today, Mar 2, 2026");
  });

  it("returns plain date when not today", async () => {
    vi.doMock("date-fns", () => ({
      format: () => "Feb 28, 2026",
      isSameDay: () => false,
    }));
    const { getDateLabel } = await import("@/features/transactions/lib/format-date");
    const now = new Date("2026-03-02");
    expect(getDateLabel({ date: new Date("2026-02-28"), now, todayLabel: "Today" })).toBe(
      "Feb 28, 2026"
    );
  });

  it("uses custom today label", async () => {
    vi.doMock("date-fns", () => ({
      format: () => "2 mar 2026",
      isSameDay: () => true,
    }));
    const { getDateLabel } = await import("@/features/transactions/lib/format-date");
    const now = new Date("2026-03-02");
    expect(getDateLabel({ date: now, now, todayLabel: "Hoy" })).toBe("Hoy, 2 mar 2026");
  });
});
