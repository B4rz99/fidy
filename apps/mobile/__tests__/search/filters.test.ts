import { describe, expect, it } from "vitest";
import { countActiveFilters, hasActiveFilters } from "../../features/search/lib/filters";
import type { SearchFilters } from "../../features/search/lib/types";
import { EMPTY_FILTERS } from "../../features/search/lib/types";

const withFilters = (overrides: Partial<SearchFilters>): SearchFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe("hasActiveFilters", () => {
  it("returns false for EMPTY_FILTERS", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("returns true when query is non-empty", () => {
    expect(hasActiveFilters(withFilters({ query: "coffee" }))).toBe(true);
  });

  it("returns false for whitespace-only query", () => {
    expect(hasActiveFilters(withFilters({ query: "   " }))).toBe(false);
  });

  it("returns true when categoryIds is non-empty", () => {
    expect(hasActiveFilters(withFilters({ categoryIds: ["food"] }))).toBe(true);
  });

  it("returns false for empty categoryIds array", () => {
    expect(hasActiveFilters(withFilters({ categoryIds: [] }))).toBe(false);
  });

  it("returns true when dateFrom is set", () => {
    expect(hasActiveFilters(withFilters({ dateFrom: "2026-03-01" }))).toBe(true);
  });

  it("returns true when dateTo is set", () => {
    expect(hasActiveFilters(withFilters({ dateTo: "2026-03-31" }))).toBe(true);
  });

  it("returns true when amountMin is set", () => {
    expect(hasActiveFilters(withFilters({ amountMin: 100 }))).toBe(true);
  });

  it("returns true when amountMax is set", () => {
    expect(hasActiveFilters(withFilters({ amountMax: 5000 }))).toBe(true);
  });

  it("returns true when type is expense", () => {
    expect(hasActiveFilters(withFilters({ type: "expense" }))).toBe(true);
  });

  it("returns true when type is income", () => {
    expect(hasActiveFilters(withFilters({ type: "income" }))).toBe(true);
  });

  it("returns false when type is all", () => {
    expect(hasActiveFilters(withFilters({ type: "all" }))).toBe(false);
  });
});

describe("countActiveFilters", () => {
  it("returns 0 for EMPTY_FILTERS", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("counts query as one dimension", () => {
    expect(countActiveFilters(withFilters({ query: "test" }))).toBe(1);
  });

  it("counts categoryIds as one dimension", () => {
    expect(countActiveFilters(withFilters({ categoryIds: ["food", "transport"] }))).toBe(1);
  });

  it("counts dateFrom and dateTo together as one dimension", () => {
    expect(countActiveFilters(withFilters({ dateFrom: "2026-03-01", dateTo: "2026-03-31" }))).toBe(
      1
    );
  });

  it("counts dateFrom alone as one dimension", () => {
    expect(countActiveFilters(withFilters({ dateFrom: "2026-03-01" }))).toBe(1);
  });

  it("counts amount range as one dimension", () => {
    expect(countActiveFilters(withFilters({ amountMin: 100, amountMax: 5000 }))).toBe(1);
  });

  it("counts type as one dimension", () => {
    expect(countActiveFilters(withFilters({ type: "expense" }))).toBe(1);
  });

  it("counts all five dimensions correctly", () => {
    const allActive = withFilters({
      query: "coffee",
      categoryIds: ["food"],
      dateFrom: "2026-03-01",
      amountMin: 100,
      type: "expense",
    });
    expect(countActiveFilters(allActive)).toBe(5);
  });

  it("does not count whitespace-only query", () => {
    expect(countActiveFilters(withFilters({ query: "  " }))).toBe(0);
  });
});
