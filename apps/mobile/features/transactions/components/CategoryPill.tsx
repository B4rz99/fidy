import * as Haptics from "expo-haptics";
import { memo } from "react";
import { Pressable } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import type { Category } from "../lib/categories";

type CategoryPillProps = {
  category: Category;
  isSelected: boolean;
  onPress: () => void;
};

export const CategoryPill = memo(({ category, isSelected, onPress }: CategoryPillProps) => {
  const peachLight = useThemeColor("peachLight");
  const Icon = category.icon;

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      className="h-8 w-8 items-center justify-center rounded-full"
      style={{
        backgroundColor: isSelected ? category.color : peachLight,
      }}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={category.label.en}
    >
      <Icon size={16} color={isSelected ? "#FFFFFF" : category.color} />
    </Pressable>
  );
});

CategoryPill.displayName = "CategoryPill";
