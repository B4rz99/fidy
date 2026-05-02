import { useCallback, useMemo } from "react";
import type { StoredTransaction } from "@/features/transactions/query.public";
import { TAB_BAR_CLEARANCE } from "@/shared/components";
import { FlatList } from "@/shared/components/rn";
import { toIsoDate } from "@/shared/lib";
import { hasActiveFilters } from "../../lib/filters";
import { SearchEmptyState } from "../SearchEmptyState";
import { SearchListHeader } from "./SearchListHeader";
import type { SearchScreenViewModel } from "./SearchScreen.types";
import { SearchTransactionItem } from "./SearchTransactionItem";

type SearchResultsListProps = Pick<
  SearchScreenViewModel,
  | "activePanel"
  | "filterPanel"
  | "filters"
  | "handleClearAll"
  | "handleEndReached"
  | "handleTogglePanel"
  | "results"
  | "showSummary"
  | "summary"
>;

export function SearchResultsList({
  activePanel,
  filterPanel,
  filters,
  handleClearAll,
  handleEndReached,
  handleTogglePanel,
  results,
  showSummary,
  summary,
}: SearchResultsListProps) {
  const dateBreaks = useMemo(() => {
    const breaks = new Set<string>();
    let lastDateKey: string | null = null;

    results.forEach((tx) => {
      const dateKey = toIsoDate(tx.date);
      if (dateKey !== lastDateKey) {
        breaks.add(tx.id);
        lastDateKey = dateKey;
      }
    });

    return breaks;
  }, [results]);

  const keyExtractor = useCallback((item: StoredTransaction) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: StoredTransaction }) => (
      <SearchTransactionItem tx={item} showDateHeader={dateBreaks.has(item.id)} />
    ),
    [dateBreaks]
  );

  return (
    <FlatList
      data={results}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      ListHeaderComponent={
        <SearchListHeader
          activePanel={activePanel}
          filterPanel={filterPanel}
          filters={filters}
          handleClearAll={handleClearAll}
          handleTogglePanel={handleTogglePanel}
          showSummary={showSummary}
          summary={summary}
        />
      }
      ListEmptyComponent={
        hasActiveFilters(filters) ? <SearchEmptyState onClearFilters={handleClearAll} /> : undefined
      }
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
    />
  );
}
