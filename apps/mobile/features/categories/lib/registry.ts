import { CATEGORIES, CATEGORY_ROWS, type Category } from "@/features/transactions";
import { Ellipsis } from "@/shared/components/icons";
import type { CategoryId } from "@/shared/types/branded";
import { ICON_MAP } from "./icon-map";

export type CategoryRegistryScope = "built_in" | "merged";

export type CategoryRegistryRow = {
  readonly id: string;
  readonly name: string;
  readonly iconName: string;
  readonly colorHex: string;
};

export type CategoryRegistrySnapshot = {
  readonly builtIn: readonly Category[];
  readonly custom: readonly Category[];
  readonly merged: readonly Category[];
  readonly builtInRows: readonly (readonly Category[])[];
  readonly byId: ReadonlyMap<string, Category>;
  readonly builtInIds: ReadonlySet<string>;
  readonly mergedIds: ReadonlySet<string>;
};

const toCustomCategory = (row: CategoryRegistryRow): Category => ({
  id: row.id as unknown as CategoryId,
  label: { en: row.name, es: row.name },
  icon: ICON_MAP[row.iconName] ?? Ellipsis,
  color: row.colorHex,
});

const toCategoryById = (categories: readonly Category[]) =>
  new Map(categories.map((category) => [category.id, category] as const));

export function createCategoryRegistrySnapshot(
  rows: readonly CategoryRegistryRow[]
): CategoryRegistrySnapshot {
  const custom = rows.map(toCustomCategory);
  const merged = [...CATEGORIES, ...custom];

  return {
    builtIn: CATEGORIES,
    custom,
    merged,
    builtInRows: CATEGORY_ROWS,
    byId: toCategoryById(merged),
    builtInIds: new Set(CATEGORIES.map((category) => category.id)),
    mergedIds: new Set(merged.map((category) => category.id)),
  };
}

export function isCategoryIdValid(
  snapshot: CategoryRegistrySnapshot,
  id: string,
  scope: CategoryRegistryScope = "built_in"
): boolean {
  return scope === "merged" ? snapshot.mergedIds.has(id) : snapshot.builtInIds.has(id);
}
