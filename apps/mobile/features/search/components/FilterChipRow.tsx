import * as Haptics from "expo-haptics";
import { Chip } from "@/shared/components";
import { ScrollView } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { hasActiveFilters } from "../lib/filters";
import type { SearchFilters } from "../lib/types";

export type FilterKey = "category" | "dateRange" | "amount" | "type";

type FilterChipRowProps = {
  filters: SearchFilters;
  activePanel: FilterKey | null;
  onTogglePanel: (key: FilterKey) => void;
  onClearAll: () => void;
};

type ChipConfig = {
  readonly key: FilterKey;
  readonly labelKey: string;
  readonly isActive: (filters: SearchFilters) => boolean;
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

export const FilterChipRow = ({
  filters,
  activePanel,
  onTogglePanel,
  onClearAll,
}: FilterChipRowProps) => {
  const { t } = useTranslation();
  const showClear = hasActiveFilters(filters);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      className="pt-2 pb-3"
    >
      {CHIPS.map((chip) => {
        const isActive = chip.isActive(filters);
        const isOpen = activePanel === chip.key;
        return (
          <Chip
            key={chip.key}
            label={t(chip.labelKey)}
            tone={isActive ? "primary" : "neutral"}
            selected={isOpen}
            className="px-4"
            onPress={() => {
              void Haptics.selectionAsync();
              onTogglePanel(chip.key);
            }}
          />
        );
      })}
      {showClear && (
        <Chip
          label={t("search.clearAll")}
          tone="danger"
          className="px-4"
          onPress={() => {
            void Haptics.selectionAsync();
            onClearAll();
          }}
        />
      )}
    </ScrollView>
  );
};
