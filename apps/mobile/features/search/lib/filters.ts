import type { SearchFilters } from "./types";

const getActiveFilterDimensions = (filters: SearchFilters): readonly boolean[] => [
  filters.query.trim().length > 0,
  filters.categoryIds.length > 0,
  filters.dateFrom !== null || filters.dateTo !== null,
  filters.amountMin !== null || filters.amountMax !== null,
  filters.type !== "all",
];

export function hasActiveFilters(filters: SearchFilters): boolean {
  return getActiveFilterDimensions(filters).some(Boolean);
}
