import type { SearchFilters } from "./types";

type SearchRouteParams = {
  readonly categoryId?: string | readonly string[];
};

function getFirstNonEmptyRouteParam(value: string | readonly string[] | undefined): string | null {
  if (value === undefined) return null;

  const values = Array.isArray(value) ? value : [value];
  const normalizedValues = values.flatMap((entry) => {
    const trimmed = entry.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  });

  return normalizedValues[0] ?? null;
}

export function resolveSearchRouteFilters(params: SearchRouteParams): Partial<SearchFilters> {
  const categoryId = getFirstNonEmptyRouteParam(params.categoryId);

  return categoryId ? { categoryIds: [categoryId] } : {};
}
