import * as Haptics from "expo-haptics";
import { Chip } from "@/shared/components";

export type FilterChipItemKey = "category" | "dateRange" | "amount" | "type";

type FilterChipItemProps = {
  readonly id: FilterChipItemKey;
  readonly isActive: boolean;
  readonly isOpen: boolean;
  readonly label: string;
  readonly onTogglePanel: (key: FilterChipItemKey) => void;
};

export function FilterChipItem({
  id,
  isActive,
  isOpen,
  label,
  onTogglePanel,
}: FilterChipItemProps) {
  const isHighlighted = isActive || isOpen;

  const handlePress = () => {
    void Haptics.selectionAsync();
    onTogglePanel(id);
  };

  return (
    <Chip
      label={label}
      tone={isHighlighted ? "primary" : "neutral"}
      selected={isHighlighted}
      style={{ paddingHorizontal: 16 }}
      onPress={handlePress}
    />
  );
}
