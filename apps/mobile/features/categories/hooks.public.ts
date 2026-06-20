import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCategoriesStore } from "./store";

export const useAvailableCategories = () =>
  useCategoriesStore(useShallow((state) => [...state.builtIn, ...state.custom]));

export const useAvailableCategoryMap = () => {
  const categories = useAvailableCategories();

  return useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
};
