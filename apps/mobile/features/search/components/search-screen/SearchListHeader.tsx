import { StyleSheet, View } from "@/shared/components/rn";
import { FilterChipRow } from "../FilterChipRow";
import { ResultsSummary } from "../ResultsSummary";
import { SearchInputBar } from "./SearchInputBar";
import type { SearchScreenViewModel } from "./SearchScreen.types";

type SearchListHeaderProps = Pick<
  SearchScreenViewModel,
  | "activePanel"
  | "filterPanel"
  | "filters"
  | "handleClearAll"
  | "handleTextChange"
  | "handleTogglePanel"
  | "inputRef"
  | "inputText"
  | "peachLight"
  | "primary"
  | "secondary"
  | "showSummary"
  | "summary"
> & {
  readonly placeholder: string;
};

export function SearchListHeader({
  activePanel,
  filterPanel,
  filters,
  handleClearAll,
  handleTextChange,
  handleTogglePanel,
  inputRef,
  inputText,
  peachLight,
  placeholder,
  primary,
  secondary,
  showSummary,
  summary,
}: SearchListHeaderProps) {
  return (
    <>
      <SearchInputBar
        handleTextChange={handleTextChange}
        inputRef={inputRef}
        inputText={inputText}
        peachLight={peachLight}
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
        <View
          className="mx-4 mb-3 rounded-lg bg-card/90 dark:bg-card-dark/90"
          style={[styles.filterDock, activePanel === "dateRange" ? styles.dateFilterDock : null]}
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
  dateFilterDock: {
    minHeight: 140,
  },
});
