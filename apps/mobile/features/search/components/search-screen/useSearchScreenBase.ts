import { useLocalSearchParams } from "expo-router";
import { useOptionalUserId } from "@/features/auth/public";
import { getDb } from "@/shared/db";
import { useThemeColor } from "@/shared/hooks";
import { resolveSearchRouteFilters } from "../../lib/route-params";
import { useSearchStore } from "../../store";

export function useSearchScreenBase() {
  const routeParams = useLocalSearchParams<{
    category?: string | string[];
    categoryId?: string | string[];
  }>();
  const userId = useOptionalUserId();
  const initialRouteFilters = resolveSearchRouteFilters(routeParams);
  const filters = useSearchStore((s) => s.filters);
  const results = useSearchStore((s) => s.results);
  const hasMore = useSearchStore((s) => s.hasMore);
  const summary = useSearchStore((s) => s.summary);

  return {
    db: userId ? getDb(userId) : null,
    filters,
    hasMore,
    initialRouteFilters,
    peachLight: useThemeColor("peachLight"),
    primary: useThemeColor("primary"),
    reset: useSearchStore((s) => s.reset),
    results,
    secondary: useThemeColor("secondary"),
    shouldAutoFocusInput: initialRouteFilters.categoryIds == null,
    summary,
    userId,
  };
}
