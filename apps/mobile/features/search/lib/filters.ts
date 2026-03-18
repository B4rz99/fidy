import type { SearchFilters } from "./types";

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.categoryIds.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.amountMinCents !== null ||
    filters.amountMaxCents !== null ||
    filters.type !== "all"
  );
}

export function countActiveFilters(filters: SearchFilters): number {
  const dimensions = [
    filters.query.trim().length > 0,
    filters.categoryIds.length > 0,
    filters.dateFrom !== null || filters.dateTo !== null,
    filters.amountMinCents !== null || filters.amountMaxCents !== null,
    filters.type !== "all",
  ];
  return dimensions.filter(Boolean).length;
}
