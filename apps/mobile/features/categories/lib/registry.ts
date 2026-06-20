import { CATEGORIES, type Category } from "@/shared/categories";
import { requireCategoryId } from "@/shared/types/assertions";
import { resolveCategoryIconValue } from "./icon-map";

export type CategoryRegistryRow = {
  readonly id: string;
  readonly name: string;
  readonly iconName: string;
  readonly colorHex: string;
};

export type CategoryIconOverrideRegistryRow = {
  readonly categoryId: string;
  readonly emoji: string;
};

export type CategoryColorOverrideRegistryRow = {
  readonly categoryId: string;
  readonly colorHex: string;
};

export type CategoryRegistrySnapshot = {
  readonly builtIn: readonly Category[];
  readonly custom: readonly Category[];
};

const toCustomCategory = (row: CategoryRegistryRow): Category => ({
  id: requireCategoryId(row.id),
  label: { en: row.name, es: row.name },
  icon: resolveCategoryIconValue(row.iconName),
  color: row.colorHex,
});

const applyIconOverrides = (
  categories: readonly Category[],
  overrides: ReadonlyMap<string, string>
): readonly Category[] =>
  categories.map((category) => ({
    ...category,
    icon: overrides.get(category.id) ?? category.icon,
  }));

const applyColorOverrides = (
  categories: readonly Category[],
  overrides: ReadonlyMap<string, string>
): readonly Category[] =>
  categories.map((category) => ({
    ...category,
    color: overrides.get(category.id) ?? category.color,
  }));

export function createCategoryRegistrySnapshot(
  rows: readonly CategoryRegistryRow[],
  iconOverrides: readonly CategoryIconOverrideRegistryRow[] = [],
  colorOverrides: readonly CategoryColorOverrideRegistryRow[] = []
): CategoryRegistrySnapshot {
  const iconOverrideMap = new Map(iconOverrides.map((row) => [row.categoryId, row.emoji]));
  const colorOverrideMap = new Map(colorOverrides.map((row) => [row.categoryId, row.colorHex]));
  const custom = rows.map(toCustomCategory);

  return {
    builtIn: applyColorOverrides(applyIconOverrides(CATEGORIES, iconOverrideMap), colorOverrideMap),
    custom: applyColorOverrides(applyIconOverrides(custom, iconOverrideMap), colorOverrideMap),
  };
}
