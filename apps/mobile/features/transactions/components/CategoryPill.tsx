import * as Haptics from "expo-haptics";
import { memo } from "react";
import { Pressable, Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import type { Category } from "../lib/categories";

type CategoryPillProps = {
  category: Category;
  isSelected: boolean;
  onPress: () => void;
};

export const CategoryPill = memo(({ category, isSelected, onPress }: CategoryPillProps) => {
  const { locale } = useTranslation();
  const peachLight = useThemeColor("peachLight");

  const handlePress = () => {
    void Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      className="size-8 items-center justify-center rounded-full"
      style={{
        backgroundColor: isSelected ? category.color : peachLight,
      }}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={getCategoryLabel(category, locale)}
    >
      <Text>{category.icon}</Text>
    </Pressable>
  );
});

CategoryPill.displayName = "CategoryPill";
