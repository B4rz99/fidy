import { CATEGORIES, type Category } from "@/shared/categories";
import { requireCategoryId } from "@/shared/types/assertions";
import { ICON_MAP } from "./icon-map";

export type CategoryRegistryRow = {
  readonly id: string;
  readonly name: string;
  readonly iconName: string;
  readonly colorHex: string;
};

export type CategoryRegistrySnapshot = {
  readonly builtIn: readonly Category[];
  readonly custom: readonly Category[];
};

const toCustomCategory = (row: CategoryRegistryRow): Category => ({
  id: requireCategoryId(row.id),
  label: { en: row.name, es: row.name },
  icon: ICON_MAP[row.iconName] ?? "✨",
  color: row.colorHex,
});

export function createCategoryRegistrySnapshot(
  rows: readonly CategoryRegistryRow[]
): CategoryRegistrySnapshot {
  const custom = rows.map(toCustomCategory);

  return {
    builtIn: CATEGORIES,
    custom,
  };
}
