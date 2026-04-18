import { create } from "zustand";
import { createWriteThroughMutationModule, type WriteThroughMutationModule } from "@/mutations";
import type { AnyDb } from "@/shared/db";
import { generateUserCategoryId, toIsoDateTime } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from "./lib/constants";
import { ICON_MAP } from "./lib/icon-map";
import {
  type CategoryRegistryRow,
  type CategoryRegistryScope,
  type CategoryRegistrySnapshot,
  createCategoryRegistrySnapshot,
  isCategoryIdValid,
} from "./lib/registry";
import { getUserCategoriesForUser } from "./lib/repository";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

type CategoriesState = CategoryRegistrySnapshot;

type CategoriesActions = {
  replaceSnapshot: (snapshot: CategoryRegistrySnapshot) => void;
  isValid(id: string, scope?: CategoryRegistryScope): boolean;
};

const toCustomCategoryRow = (row: {
  id: string;
  name: string;
  iconName: string;
  colorHex: string;
}): CategoryRegistryRow => ({
  id: row.id,
  name: row.name,
  iconName: row.iconName,
  colorHex: row.colorHex,
});

export const useCategoriesStore = create<CategoriesState & CategoriesActions>((set, get) => ({
  ...createCategoryRegistrySnapshot([]),

  replaceSnapshot: (snapshot) => set(snapshot),

  isValid: (id, scope = "built_in") => isCategoryIdValid(get(), id, scope),
}));

function isValidCustomCategoryInput(input: {
  name: string;
  iconName: string;
  colorHex: string;
}): boolean {
  const trimmedName = input.name.trim();
  return (
    trimmedName.length >= MIN_NAME_LENGTH &&
    trimmedName.length <= MAX_NAME_LENGTH &&
    Object.hasOwn(ICON_MAP, input.iconName) &&
    HEX_COLOR_REGEX.test(input.colorHex)
  );
}

function createCategoryMutations(db: AnyDb): WriteThroughMutationModule {
  return createWriteThroughMutationModule(db);
}

export async function refreshCategories(db: AnyDb, userId: UserId): Promise<void> {
  try {
    const rows = getUserCategoriesForUser(db, userId).map(toCustomCategoryRow);
    useCategoriesStore.getState().replaceSnapshot(createCategoryRegistrySnapshot(rows));
  } catch {
    // keep existing state
  }
}

export async function createCustomCategory(
  db: AnyDb,
  userId: UserId,
  input: { name: string; iconName: string; colorHex: string }
): Promise<boolean> {
  if (!isValidCustomCategoryInput(input)) return false;

  const trimmedName = input.name.trim();
  const now = toIsoDateTime(new Date());
  const id = generateUserCategoryId();
  const mutations = createCategoryMutations(db);

  try {
    const result = await mutations.commit({
      kind: "category.save",
      row: {
        id,
        userId,
        name: trimmedName,
        iconName: input.iconName,
        colorHex: input.colorHex,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    });
    if (!result.success) return false;
  } catch {
    return false;
  }

  await refreshCategories(db, userId);
  return true;
}
