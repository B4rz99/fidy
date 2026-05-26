import * as Haptics from "expo-haptics";
import { memo } from "react";
import { CATEGORIES, CATEGORY_ROWS, type Category } from "@/shared/categories";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";

type CategoryFilterProps = {
  selectedIds: readonly string[];
  onToggle: (categoryId: string) => void;
};

const FilterPill = memo(
  ({
    category,
    isSelected,
    onToggle,
  }: {
    category: Category;
    isSelected: boolean;
    onToggle: (categoryId: string) => void;
  }) => {
    const { locale } = useTranslation();
    const peachLight = useThemeColor("peachLight");

    const handlePress = () => {
      void Haptics.selectionAsync();
      onToggle(category.id);
    };

    return (
      <Pressable
        className="h-11 w-11 items-center justify-center gap-1"
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={getCategoryLabel(category, locale)}
      >
        <View
          className="size-8 items-center justify-center rounded-full"
          style={{ backgroundColor: peachLight }}
        >
          <Text>{category.icon}</Text>
        </View>
        <View
          className="h-0.5 w-5 rounded-full"
          style={{ backgroundColor: isSelected ? category.color : "transparent" }}
        />
      </Pressable>
    );
  }
);

FilterPill.displayName = "FilterPill";

export const CategoryFilter = ({ selectedIds, onToggle }: CategoryFilterProps) => (
  <View className="gap-3 p-4">
    {CATEGORY_ROWS.map((row, rowIdx) => (
      <View key={CATEGORIES[rowIdx * 5]?.id ?? rowIdx} className="flex-row justify-around">
        {row.map((cat) => (
          <FilterPill
            key={cat.id}
            category={cat}
            isSelected={selectedIds.includes(cat.id)}
            onToggle={onToggle}
          />
        ))}
      </View>
    ))}
  </View>
);
