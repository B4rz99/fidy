import { useAvailableCategories } from "@/features/categories/hooks.public";
import type { Category } from "@/shared/categories";
import { CategoryIconButton } from "@/shared/components";
import { FlatList, StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type CategoryFilterProps = {
  selectedIds: readonly string[];
  onToggle: (categoryId: string) => void;
};

function CategoryFilterPill({
  category,
  hasSelection,
  idleColor,
  isSelected,
  onToggle,
}: {
  category: Category;
  hasSelection: boolean;
  idleColor: string;
  isSelected: boolean;
  onToggle: (categoryId: string) => void;
}) {
  return (
    <CategoryIconButton
      category={category}
      dimmed={hasSelection && !isSelected}
      idleColor={idleColor}
      onPress={() => onToggle(category.id)}
      selected={isSelected}
      style={styles.categoryButton}
      variant="filter"
    />
  );
}

export const CategoryFilter = ({ selectedIds, onToggle }: CategoryFilterProps) => {
  const hasSelection = selectedIds.length > 0;
  const categories = useAvailableCategories();
  const surfaceRaised = useThemeColor("surfaceRaised");

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={categoryKeyExtractor}
        renderItem={({ item: cat }) => (
          <View style={styles.item}>
            <CategoryFilterPill
              category={cat}
              hasSelection={hasSelection}
              idleColor={surfaceRaised}
              isSelected={selectedIds.includes(cat.id)}
              onToggle={onToggle}
            />
          </View>
        )}
        contentContainerStyle={styles.content}
        style={styles.scroll}
      />
    </View>
  );
};

const categoryKeyExtractor = (category: Category) => category.id;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 2,
  },
  item: {
    alignItems: "center",
    height: 58,
    justifyContent: "center",
    width: 62,
  },
  categoryButton: {
    width: 44,
  },
  scroll: {
    flexGrow: 0,
    height: 62,
    maxHeight: 62,
  },
});
