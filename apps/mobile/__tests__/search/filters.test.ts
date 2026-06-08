import { describe, expect, it } from "vitest";
import { hasActiveFilters } from "../../features/search/lib/filters";
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

  it("returns true when type is transfer", () => {
    expect(hasActiveFilters(withFilters({ type: "transfer" }))).toBe(true);
  });

  it("returns false when type is all", () => {
    expect(hasActiveFilters(withFilters({ type: "all" }))).toBe(false);
  });
});
