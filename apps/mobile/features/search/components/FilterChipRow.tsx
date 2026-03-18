import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
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
    isActive: (f) => f.amountMinCents !== null || f.amountMaxCents !== null,
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
  const primary = useThemeColor("primary");
  const peachLight = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  const showClear = hasActiveFilters(filters);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      className="pt-2 pb-8"
    >
      {CHIPS.map((chip) => {
        const isActive = chip.isActive(filters);
        const isOpen = activePanel === chip.key;
        return (
          <Pressable
            key={chip.key}
            className="h-8 rounded-full px-4 items-center justify-center"
            style={{
              backgroundColor: isActive ? accentGreen : peachLight,
              borderWidth: isOpen ? 1.5 : 0,
              borderColor: isOpen ? primary : "transparent",
            }}
            onPress={() => {
              Haptics.selectionAsync();
              onTogglePanel(chip.key);
            }}
          >
            <Text
              className="font-poppins-medium text-caption"
              style={{ color: isActive ? "#FFFFFF" : primary }}
            >
              {t(chip.labelKey)}
            </Text>
          </Pressable>
        );
      })}
      {showClear && (
        <Pressable
          className="h-8 rounded-full px-4 items-center justify-center"
          onPress={() => {
            Haptics.selectionAsync();
            onClearAll();
          }}
        >
          <Text className="font-poppins-medium text-caption" style={{ color: accentRed }}>
            {t("search.clearAll")}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
};
