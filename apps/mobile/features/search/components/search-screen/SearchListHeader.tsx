import { View } from "@/shared/components/rn";
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
          className="mx-4 mb-3 rounded-xl bg-card dark:bg-card-dark"
          style={{ overflow: "hidden" }}
        >
          {filterPanel}
        </View>
      ) : null}
      {showSummary && summary ? <ResultsSummary summary={summary} /> : null}
    </>
  );
}
