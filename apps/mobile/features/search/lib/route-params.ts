import type { SearchFilters } from "./types";

type SearchRouteParams = {
  readonly categoryId?: string | readonly string[];
  readonly category?: string | readonly string[];
};

function getFirstNonEmptyRouteParam(value: string | readonly string[] | undefined): string | null {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  return value?.find((entry) => entry.trim().length > 0)?.trim() ?? null;
}

export function resolveSearchRouteFilters(params: SearchRouteParams): Partial<SearchFilters> {
  const categoryId =
    getFirstNonEmptyRouteParam(params.categoryId) ?? getFirstNonEmptyRouteParam(params.category);

  return categoryId ? { categoryIds: [categoryId] } : {};
}
