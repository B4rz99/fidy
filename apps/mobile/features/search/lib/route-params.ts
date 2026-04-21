import type { SearchFilters } from "./types";

type SearchRouteParams = {
  readonly categoryId?: string | readonly string[];
  readonly category?: string | readonly string[];
};

function getFirstNonEmptyRouteParam(value: string | readonly string[] | undefined): string | null {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const normalizedValues = values.map((entry) => entry.trim()).filter((entry) => entry.length > 0);

  return normalizedValues[0] ?? null;
}

export function resolveSearchRouteFilters(params: SearchRouteParams): Partial<SearchFilters> {
  const categoryId =
    getFirstNonEmptyRouteParam(params.categoryId) ?? getFirstNonEmptyRouteParam(params.category);

  return categoryId ? { categoryIds: [categoryId] } : {};
}
