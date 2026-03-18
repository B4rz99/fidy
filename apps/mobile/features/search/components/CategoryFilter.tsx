import * as Haptics from "expo-haptics";
import { memo } from "react";
import { CATEGORIES, CATEGORY_ROWS, type Category } from "@/features/transactions";
import { Check } from "@/shared/components/icons";
import { Pressable, View } from "@/shared/components/rn";
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
    onPress,
  }: {
    category: Category;
    isSelected: boolean;
    onPress: () => void;
  }) => {
    const { locale } = useTranslation();
    const peachLight = useThemeColor("peachLight");
    const Icon = category.icon;

    const handlePress = () => {
      Haptics.selectionAsync();
      onPress();
    };

    return (
      <Pressable
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: isSelected ? category.color : peachLight }}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={getCategoryLabel(category, locale)}
      >
        {isSelected ? (
          <Check size={16} color="#FFFFFF" />
        ) : (
          <Icon size={16} color={category.color} />
        )}
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
            onPress={() => onToggle(cat.id)}
          />
        ))}
      </View>
    ))}
  </View>
);
