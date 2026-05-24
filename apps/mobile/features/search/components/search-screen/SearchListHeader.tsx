import { StyleSheet, View } from "@/shared/components/rn";
import { FilterChipRow } from "../FilterChipRow";
import { ResultsSummary } from "../ResultsSummary";
import type { SearchScreenViewModel } from "./SearchScreen.types";

type SearchListHeaderProps = Pick<
  SearchScreenViewModel,
  | "activePanel"
  | "filterPanel"
  | "filters"
  | "handleClearAll"
  | "handleTogglePanel"
  | "showSummary"
  | "summary"
>;

export function SearchListHeader({
  activePanel,
  filterPanel,
  filters,
  handleClearAll,
  handleTogglePanel,
  showSummary,
  summary,
}: SearchListHeaderProps) {
  return (
    <>
      <FilterChipRow
        filters={filters}
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
        onClearAll={handleClearAll}
      />
      {filterPanel ? (
        <View
          className="mx-4 mb-3 rounded-lg bg-card/90 dark:bg-card-dark/90"
          style={styles.filterDock}
        >
          {filterPanel}
        </View>
      ) : null}
      {showSummary && summary ? <ResultsSummary summary={summary} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  filterDock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
});
