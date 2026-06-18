import { useCallback, useMemo } from "react";
import { FeedList, TAB_BAR_CLEARANCE } from "@/shared/components";
import { StyleSheet } from "@/shared/components/rn";
import { toIsoDate } from "@/shared/lib";
import { hasActiveFilters } from "../../lib/filters";
import type { SearchResult } from "../../lib/types";
import { SearchEmptyState } from "../SearchEmptyState";
import { SearchFilterControls } from "./SearchFilterControls";
import type { SearchScreenViewModel } from "./SearchScreen.types";
import { SearchTransactionItem } from "./SearchTransactionItem";

type SearchResultsListProps = Pick<
  SearchScreenViewModel,
  | "activePanel"
  | "filterPanel"
  | "filters"
  | "handleClearAll"
  | "handleEndReached"
  | "handleTextChange"
  | "handleTogglePanel"
  | "inputRef"
  | "inputText"
  | "primary"
  | "results"
  | "secondary"
  | "showSummary"
  | "summary"
> & {
  readonly placeholder: string;
};

export function SearchResultsList({
  activePanel,
  filterPanel,
  filters,
  handleClearAll,
  handleEndReached,
  handleTextChange,
  handleTogglePanel,
  inputRef,
  inputText,
  placeholder,
  primary,
  results,
  secondary,
  showSummary,
  summary,
}: SearchResultsListProps) {
  const hasFilters = hasActiveFilters(filters);

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

  const keyExtractor = useCallback((item: SearchResult) => `${item.kind}:${item.id}`, []);
  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <SearchTransactionItem item={item} showDateHeader={dateBreaks.has(item.id)} />
    ),
    [dateBreaks]
  );

  return (
    <FeedList
      key={hasFilters ? "filtered-results" : "unfiltered-results"}
      data={results}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      header={
        <SearchFilterControls
          activePanel={activePanel}
          filterPanel={filterPanel}
          filters={filters}
          handleTextChange={handleTextChange}
          handleTogglePanel={handleTogglePanel}
          inputRef={inputRef}
          inputText={inputText}
          placeholder={placeholder}
          primary={primary}
          secondary={secondary}
          showSummary={showSummary}
          summary={summary}
        />
      }
      empty={hasFilters ? <SearchEmptyState onClearFilters={handleClearAll} /> : undefined}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: TAB_BAR_CLEARANCE,
  },
});
