import * as Haptics from "expo-haptics";
import { memo } from "react";
import { GlassPressable } from "@/shared/components/GlassPressable";
import { Text } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import type { Category } from "../lib/categories";

type CategoryPillProps = {
  category: Category;
  isSelected: boolean;
  onPress: () => void;
};

export const CategoryPill = memo(({ category, isSelected, onPress }: CategoryPillProps) => {
  const { locale } = useTranslation();

  const handlePress = () => {
    void Haptics.selectionAsync();
    onPress();
  };

  return (
    <GlassPressable
      className="size-8 items-center justify-center rounded-full"
      radius={16}
      padded={false}
      surfaceLayoutStyle={{ alignItems: "center", height: 32, justifyContent: "center", width: 32 }}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={getCategoryLabel(category, locale)}
    >
      <Text>{category.icon}</Text>
    </GlassPressable>
  );
});

CategoryPill.displayName = "CategoryPill";
