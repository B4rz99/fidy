export { CategoriesScreen } from "./components/CategoriesScreen";
export { CreateCategorySheet } from "./components/CreateCategorySheet";
export type { CategoryRegistryScope, CategoryRegistrySnapshot } from "./lib/registry";
export { createCategoryRegistrySnapshot, isCategoryIdValid } from "./lib/registry";
export { createCustomCategory, refreshCategories, useCategoriesStore } from "./store";
