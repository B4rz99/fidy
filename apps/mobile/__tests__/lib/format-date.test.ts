import { describe, expect, it } from "vitest";
import { formatDateDisplay, toIsoDate } from "@/shared/lib/format-date";

describe("formatDateDisplay", () => {
  it("converts ISO date to DD-MM-YYYY", () => {
    expect(formatDateDisplay("2026-03-04")).toBe("04-03-2026");
  });

  it("handles single-digit day and month", () => {
    expect(formatDateDisplay("2026-01-05")).toBe("05-01-2026");
  });

  it("handles end of year", () => {
    expect(formatDateDisplay("2025-12-31")).toBe("31-12-2025");
  });
});

describe("toIsoDate", () => {
  it("converts a Date to YYYY-MM-DD string", () => {
    const date = new Date(2026, 2, 4); // March 4, 2026
    expect(toIsoDate(date)).toBe("2026-03-04");
  });

  it("pads single-digit month and day", () => {
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    expect(toIsoDate(date)).toBe("2026-01-05");
  });
});
