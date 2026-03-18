import { describe, expect, it } from "vitest";
import { DATE_PRESETS, getDatePresetRange } from "../../features/search/lib/date-presets";

// Fixed date: Wednesday, March 18, 2026
const TODAY = new Date(2026, 2, 18);

describe("DATE_PRESETS", () => {
  it("has four presets", () => {
    expect(DATE_PRESETS).toHaveLength(4);
  });

  it("today preset returns same date for from and to", () => {
    const preset = DATE_PRESETS.find((p) => p.key === "today");
    const range = preset?.getRange(TODAY);
    expect(range).toEqual({ from: "2026-03-18", to: "2026-03-18" });
  });

  it("thisWeek preset returns Monday to today", () => {
    const preset = DATE_PRESETS.find((p) => p.key === "thisWeek");
    const range = preset?.getRange(TODAY);
    expect(range).toEqual({ from: "2026-03-16", to: "2026-03-18" });
  });

  it("thisMonth preset returns 1st of month to today", () => {
    const preset = DATE_PRESETS.find((p) => p.key === "thisMonth");
    const range = preset?.getRange(TODAY);
    expect(range).toEqual({ from: "2026-03-01", to: "2026-03-18" });
  });

  it("lastMonth preset returns full previous month", () => {
    const preset = DATE_PRESETS.find((p) => p.key === "lastMonth");
    const range = preset?.getRange(TODAY);
    expect(range).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("lastMonth handles month with 31 days", () => {
    // April 15, 2026 — last month is March (31 days)
    const april15 = new Date(2026, 3, 15);
    const preset = DATE_PRESETS.find((p) => p.key === "lastMonth");
    const range = preset?.getRange(april15);
    expect(range).toEqual({ from: "2026-03-01", to: "2026-03-31" });
  });

  it("thisWeek on Monday returns Monday as both from and to", () => {
    // Monday, March 16, 2026
    const monday = new Date(2026, 2, 16);
    const preset = DATE_PRESETS.find((p) => p.key === "thisWeek");
    const range = preset?.getRange(monday);
    expect(range).toEqual({ from: "2026-03-16", to: "2026-03-16" });
  });
});

describe("getDatePresetRange", () => {
  it("returns range for known key", () => {
    const range = getDatePresetRange("today", TODAY);
    expect(range).toEqual({ from: "2026-03-18", to: "2026-03-18" });
  });

  it("returns null for unknown key", () => {
    expect(getDatePresetRange("nextYear", TODAY)).toBeNull();
  });
});
