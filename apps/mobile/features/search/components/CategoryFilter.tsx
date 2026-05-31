import * as Haptics from "expo-haptics";
import { memo } from "react";
import { CATEGORIES, CATEGORY_ROWS, type Category } from "@/shared/categories";
import { FilterPill as SharedFilterPill } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";

type CategoryFilterProps = {
  selectedIds: readonly string[];
  onToggle: (categoryId: string) => void;
};

const CategoryFilterPill = memo(
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
      <SharedFilterPill
        className="h-11 w-11 px-0"
        onPress={handlePress}
        selected={isSelected}
        accessibilityLabel={getCategoryLabel(category, locale)}
        leading={
          <View className="items-center" style={{ gap: 3 }}>
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
          </View>
        }
      />
    );
  }
);

CategoryFilterPill.displayName = "CategoryFilterPill";

export const CategoryFilter = ({ selectedIds, onToggle }: CategoryFilterProps) => (
  <View className="gap-3 p-4">
    {CATEGORY_ROWS.map((row, rowIdx) => (
      <View key={CATEGORIES[rowIdx * 5]?.id ?? rowIdx} className="flex-row justify-around">
        {row.map((cat) => (
          <CategoryFilterPill
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
