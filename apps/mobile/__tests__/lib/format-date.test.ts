import { describe, expect, it } from "vitest";
import {
  formatDateDisplay,
  parseIsoDate,
  parseOptionalIsoDate,
  toIsoDate,
} from "@/shared/lib/format-date";
import type { IsoDate } from "@/shared/types/branded";

describe("formatDateDisplay", () => {
  it("converts ISO date to DD-MM-YYYY", () => {
    expect(formatDateDisplay("2026-03-04" as IsoDate)).toBe("04-03-2026");
  });

  it("handles single-digit day and month", () => {
    expect(formatDateDisplay("2026-01-05" as IsoDate)).toBe("05-01-2026");
  });

  it("handles end of year", () => {
    expect(formatDateDisplay("2025-12-31" as IsoDate)).toBe("31-12-2025");
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

describe("parseIsoDate", () => {
  it("parses ISO date string to local midnight", () => {
    const date = parseIsoDate("2026-03-04" as IsoDate);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2); // March = 2
    expect(date.getDate()).toBe(4);
  });

  it("roundtrips with toIsoDate", () => {
    const iso = "2026-01-15" as IsoDate;
    expect(toIsoDate(parseIsoDate(iso))).toBe(iso);
  });
});

describe("parseOptionalIsoDate", () => {
  it("returns null for absent values", () => {
    expect(parseOptionalIsoDate(null)).toBeNull();
    expect(parseOptionalIsoDate(undefined)).toBeNull();
  });

  it("parses present ISO dates", () => {
    expect(toIsoDate(parseOptionalIsoDate("2026-04-09") ?? new Date())).toBe("2026-04-09");
  });

  it("rejects invalid optional ISO dates", () => {
    expect(() => parseOptionalIsoDate("2026-02-30")).toThrow(
      "date must be a valid ISO calendar date"
    );
  });
});
