import * as Haptics from "expo-haptics";
import { Chip } from "@/shared/components";

export type FilterChipItemKey = "category" | "dateRange" | "amount" | "type" | "clearAll";

type FilterChipItemProps = {
  readonly id: FilterChipItemKey;
  readonly isActive: boolean;
  readonly isOpen: boolean;
  readonly label: string;
  readonly onClearAll: () => void;
  readonly onTogglePanel: (key: Exclude<FilterChipItemKey, "clearAll">) => void;
};

export function FilterChipItem({
  id,
  isActive,
  isOpen,
  label,
  onClearAll,
  onTogglePanel,
}: FilterChipItemProps) {
  const isClearAll = id === "clearAll";
  const isHighlighted = !isClearAll && (isActive || isOpen);

  const handlePress = () => {
    void Haptics.selectionAsync();
    if (isClearAll) {
      onClearAll();
    } else {
      onTogglePanel(id);
    }
  };

  return (
    <Chip
      label={label}
      tone={isClearAll ? "danger" : isHighlighted ? "primary" : "neutral"}
      selected={isHighlighted}
      style={{ paddingHorizontal: 16 }}
      onPress={handlePress}
    />
  );
}
