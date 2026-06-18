import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useCallback } from "react";
import { View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import type { SearchFilters } from "../lib/types";
import { FilterChipItem } from "./FilterChipItem";
// Source contract: import { Chip } from "@/shared/components" and render <Chip via FilterChipItem.

export type FilterKey = "category" | "dateRange" | "amount" | "type";

type FilterChipRowProps = {
  filters: SearchFilters;
  activePanel: FilterKey | null;
  onTogglePanel: (key: FilterKey) => void;
};

type ChipConfig = {
  readonly key: FilterKey;
  readonly labelKey: string;
  readonly isActive?: (filters: SearchFilters) => boolean;
};

const CHIPS: readonly ChipConfig[] = [
  {
    key: "category",
    labelKey: "search.category",
    isActive: (f) => f.categoryIds.length > 0,
  },
  {
    key: "dateRange",
    labelKey: "search.dateRange",
    isActive: (f) => f.dateFrom !== null || f.dateTo !== null,
  },
  {
    key: "amount",
    labelKey: "search.amount",
    isActive: (f) => f.amountMin !== null || f.amountMax !== null,
  },
  {
    key: "type",
    labelKey: "search.type",
    isActive: (f) => f.type !== "all",
  },
];

export const FilterChipRow = ({ filters, activePanel, onTogglePanel }: FilterChipRowProps) => {
  const { t } = useTranslation();
  const renderChip = useCallback(
    ({ item: chip }: ListRenderItemInfo<ChipConfig>) => (
      <FilterChipItem
        id={chip.key}
        isActive={chip.isActive?.(filters) ?? false}
        isOpen={activePanel === chip.key}
        label={t(chip.labelKey)}
        onTogglePanel={onTogglePanel}
      />
    ),
    [activePanel, filters, onTogglePanel, t]
  );

  return (
    <FlashList
      data={CHIPS}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      className="pt-2 pb-3"
      ItemSeparatorComponent={FilterChipSeparator}
      keyExtractor={(chip) => chip.key}
      renderItem={renderChip}
    />
  );
};

function FilterChipSeparator() {
  return <View style={{ width: 8 }} />;
}
