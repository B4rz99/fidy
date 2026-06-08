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
      tone={isClearAll ? "danger" : isActive ? "primary" : "neutral"}
      selected={!isClearAll && isOpen}
      style={{ marginRight: 8, paddingHorizontal: 16 }}
      onPress={handlePress}
    />
  );
}
