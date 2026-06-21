import { FlashList } from "@shopify/flash-list";
import type { Category } from "@/shared/categories";
import { StyleSheet, View } from "@/shared/components/rn";
import type { CategoryId } from "@/shared/types/branded";
import { CategoryPill } from "./CategoryPill";

type CategoryStripProps = {
  readonly categories: readonly Category[];
  readonly categoryId: CategoryId | null;
  readonly onCategoryChange: (categoryId: CategoryId) => void;
};

export function CategoryStrip({ categories, categoryId, onCategoryChange }: CategoryStripProps) {
  return (
    <FlashList
      data={categories}
      horizontal
      keyExtractor={(category) => category.id}
      renderItem={({ item: category }) => (
        <View style={styles.item}>
          <CategoryPill
            category={category}
            isSelected={categoryId === category.id}
            onPress={() => onCategoryChange(category.id)}
          />
        </View>
      )}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroll}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  item: {
    alignItems: "center",
    height: 56,
    justifyContent: "center",
    width: 58,
  },
  scroll: {
    flexGrow: 0,
    height: 64,
    maxHeight: 64,
  },
});
