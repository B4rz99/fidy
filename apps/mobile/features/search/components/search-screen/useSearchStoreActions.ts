import { useCallback } from "react";
import type { SearchFilters } from "../../lib/types";
import { loadNextSearchPage, updateSearchFilters, useSearchStore } from "../../store";
import type { SearchDb, SearchUserId } from "./SearchScreen.types";

type SearchStoreActionsArgs = {
  readonly db: SearchDb;
  readonly hasMore: boolean;
  readonly userId: SearchUserId;
};

function toggleCategoryId(categoryId: string) {
  const current = useSearchStore.getState().filters.categoryIds;
  return current.includes(categoryId)
    ? current.filter((id) => id !== categoryId)
    : [...current, categoryId];
}

export function useSearchStoreActions(args: SearchStoreActionsArgs) {
  const { db, hasMore, userId } = args;

  const handleCategoryToggle = useCallback(
    (categoryId: string) => {
      if (db && userId) {
        updateSearchFilters(db, userId, { categoryIds: toggleCategoryId(categoryId) });
      }
    },
    [db, userId]
  );

  const handleDateRangeChange = useCallback(
    (dateFrom: string | null, dateTo: string | null) => {
      if (db && userId) updateSearchFilters(db, userId, { dateFrom, dateTo });
    },
    [db, userId]
  );

  const handleTypeChange = useCallback(
    (type: SearchFilters["type"]) => {
      if (db && userId) updateSearchFilters(db, userId, { type });
    },
    [db, userId]
  );

  const handleEndReached = useCallback(() => {
    if (db && userId && hasMore) loadNextSearchPage(db, userId);
  }, [db, hasMore, userId]);

  return { handleCategoryToggle, handleDateRangeChange, handleEndReached, handleTypeChange };
}
