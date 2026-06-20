import { memo } from "react";
import { CategoryIconButton } from "@/shared/components";
import type { Category } from "../lib/categories";

type CategoryPillProps = {
  category: Category;
  isSelected: boolean;
  onPress: () => void;
};

export const CategoryPill = memo(({ category, isSelected, onPress }: CategoryPillProps) => {
  return <CategoryIconButton category={category} selected={isSelected} onPress={onPress} />;
});

CategoryPill.displayName = "CategoryPill";
