import type { SearchFilters } from "../../lib/types";
import type { FilterKey } from "../FilterChipRow";
import { SearchAmountPanel } from "./SearchAmountPanel";
import { SearchCategoryPanel } from "./SearchCategoryPanel";
import { SearchDateRangePanel } from "./SearchDateRangePanel";
import { SearchTypePanel } from "./SearchTypePanel";

type SearchFilterPanelProps = {
  readonly activePanel: FilterKey | null;
  readonly filters: SearchFilters;
  readonly handleCategoryToggle: (categoryId: string) => void;
  readonly handleDateRangeChange: (dateFrom: string | null, dateTo: string | null) => void;
  readonly handleMaxChange: (digits: string) => void;
  readonly handleMinChange: (digits: string) => void;
  readonly handleTypeChange: (type: SearchFilters["type"]) => void;
  readonly maxDigits: string;
  readonly minDigits: string;
};

export function SearchFilterPanel(props: SearchFilterPanelProps) {
  const panels = {
    amount: (
      <SearchAmountPanel
        minDigits={props.minDigits}
        maxDigits={props.maxDigits}
        handleMinChange={props.handleMinChange}
        handleMaxChange={props.handleMaxChange}
      />
    ),
    category: (
      <SearchCategoryPanel
        selectedIds={props.filters.categoryIds}
        handleCategoryToggle={props.handleCategoryToggle}
      />
    ),
    dateRange: (
      <SearchDateRangePanel
        dateFrom={props.filters.dateFrom}
        dateTo={props.filters.dateTo}
        handleDateRangeChange={props.handleDateRangeChange}
      />
    ),
    type: <SearchTypePanel type={props.filters.type} handleTypeChange={props.handleTypeChange} />,
  } as const;

  return props.activePanel ? panels[props.activePanel] : null;
}
