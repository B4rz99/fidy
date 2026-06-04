import { GlassSurface } from "@/shared/components";
import { StyleSheet } from "@/shared/components/rn";
import { FilterChipRow } from "../FilterChipRow";
import { ResultsSummary } from "../ResultsSummary";
import { SearchInputBar } from "./SearchInputBar";
import type { SearchScreenViewModel } from "./SearchScreen.types";

type SearchFilterControlsProps = Pick<
  SearchScreenViewModel,
  | "activePanel"
  | "filterPanel"
  | "filters"
  | "handleClearAll"
  | "handleTextChange"
  | "handleTogglePanel"
  | "inputRef"
  | "inputText"
  | "primary"
  | "secondary"
  | "showSummary"
  | "summary"
> & {
  readonly placeholder: string;
};

export function SearchFilterControls({
  activePanel,
  filterPanel,
  filters,
  handleClearAll,
  handleTextChange,
  handleTogglePanel,
  inputRef,
  inputText,
  placeholder,
  primary,
  secondary,
  showSummary,
  summary,
}: SearchFilterControlsProps) {
  return (
    <>
      <SearchInputBar
        handleTextChange={handleTextChange}
        inputRef={inputRef}
        inputText={inputText}
        placeholder={placeholder}
        primary={primary}
        secondary={secondary}
      />
      <FilterChipRow
        filters={filters}
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
        onClearAll={handleClearAll}
      />
      {filterPanel ? (
        <GlassSurface
          padded={false}
          radius={8}
          style={[styles.filterDock, activePanel === "dateRange" ? styles.dateFilterDock : null]}
        >
          {filterPanel}
        </GlassSurface>
      ) : null}
      {showSummary && summary ? <ResultsSummary summary={summary} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  filterDock: {
    boxShadow: "0 8px 12px rgba(15,23,42,0.05)",
    marginBottom: 12,
    marginHorizontal: 16,
  },
  dateFilterDock: {
    minHeight: 140,
  },
});
