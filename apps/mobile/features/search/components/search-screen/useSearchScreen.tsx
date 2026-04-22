import { hasActiveFilters } from "../../lib/filters";
import { SearchFilterPanelView } from "./SearchFilterPanelView";
import type { SearchScreenViewModel } from "./SearchScreen.types";
import { useSearchScreenBase } from "./useSearchScreenBase";
import { useSearchScreenControls } from "./useSearchScreenControls";

export function useSearchScreen(): Omit<SearchScreenViewModel, "onBack"> {
  const base = useSearchScreenBase();
  const controls = useSearchScreenControls(base);

  return {
    activePanel: controls.panel.activePanel,
    filterPanel: controls.panel.activePanel ? (
      <SearchFilterPanelView base={base} controls={controls} />
    ) : null,
    filters: base.filters,
    handleClearAll: controls.handleClearAll,
    handleEndReached: controls.actions.handleEndReached,
    handleTextChange: controls.input.handleTextChange,
    handleTogglePanel: controls.panel.handleTogglePanel,
    inputRef: controls.inputRef,
    inputText: controls.input.inputText,
    peachLight: base.peachLight,
    primary: base.primary,
    ready: controls.ready,
    results: base.results,
    secondary: base.secondary,
    showSummary: Boolean(base.summary) && hasActiveFilters(base.filters),
    summary: base.summary,
  };
}
