import { SearchFilterPanel } from "./SearchFilterPanel";
import type { useSearchScreenBase } from "./useSearchScreenBase";
import type { useSearchScreenControls } from "./useSearchScreenControls";

type SearchFilterPanelViewProps = {
  readonly base: ReturnType<typeof useSearchScreenBase>;
  readonly controls: ReturnType<typeof useSearchScreenControls>;
};

export function SearchFilterPanelView({ base, controls }: SearchFilterPanelViewProps) {
  return (
    <SearchFilterPanel
      activePanel={controls.panel.activePanel}
      filters={base.filters}
      handleCategoryToggle={controls.actions.handleCategoryToggle}
      handleDateRangeChange={controls.actions.handleDateRangeChange}
      handleMaxChange={controls.amount.handleMaxChange}
      handleMinChange={controls.amount.handleMinChange}
      handleTypeChange={controls.actions.handleTypeChange}
      maxDigits={controls.amount.maxDigits}
      minDigits={controls.amount.minDigits}
    />
  );
}
