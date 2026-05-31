export { CategoriesScreen, CreateCategoryScreen } from "./routes.public";
export type { CategoryRegistryScope, CategoryRegistrySnapshot } from "./lib/registry";
export { createCategoryRegistrySnapshot, isCategoryIdValid } from "./lib/registry";
export { createCustomCategory, refreshCategories, useCategoriesStore } from "./store";
