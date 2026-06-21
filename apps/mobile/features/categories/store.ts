import { create } from "zustand";
import {
  createWriteThroughMutationModule,
  type CategoryColorOverrideRow,
  type CategoryIconOverrideRow,
  type UserCategoryRow,
  type WriteThroughMutationModule,
} from "@/mutations";
import type { AnyDb } from "@/shared/db";
import {
  generateCategoryColorOverrideId,
  generateCategoryIconOverrideId,
  generateUserCategoryId,
  toIsoDateTime,
} from "@/shared/lib";
import type { CategoryId, UserId } from "@/shared/types/branded";
import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from "./lib/constants";
import { isCategoryIconValue, normalizeCategoryEmoji } from "./lib/icon-map";
import {
  type CategoryColorOverrideRegistryRow,
  type CategoryIconOverrideRegistryRow,
  type CategoryRegistryRow,
  type CategoryRegistrySnapshot,
  createCategoryRegistrySnapshot,
} from "./lib/registry";
import {
  getCategoryColorOverridesForUser,
  getCategoryIconOverridesForUser,
  getUserCategoriesForUser,
} from "./lib/repository";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

type CategoriesState = CategoryRegistrySnapshot;

type CategoriesActions = {
  replaceSnapshot: (snapshot: CategoryRegistrySnapshot) => void;
};

type CustomCategoryInput = {
  readonly name: string;
  readonly iconName: string;
  readonly colorHex: string;
};

type CategoryEmojiInput = {
  readonly categoryId: CategoryId;
  readonly emoji: string;
};

type CategoryColorInput = {
  readonly categoryId: CategoryId;
  readonly colorHex: string;
};

type CategoryAppearanceInput = CategoryEmojiInput & Pick<CategoryColorInput, "colorHex">;

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

const toCategoryIconOverrideRow = (row: {
  categoryId: string;
  emoji: string;
}): CategoryIconOverrideRegistryRow => ({
  categoryId: row.categoryId,
  emoji: row.emoji,
});

const toCategoryColorOverrideRow = (row: {
  categoryId: string;
  colorHex: string;
}): CategoryColorOverrideRegistryRow => ({
  categoryId: row.categoryId,
  colorHex: row.colorHex,
});

export const useCategoriesStore = create<CategoriesState & CategoriesActions>((set) => ({
  ...createCategoryRegistrySnapshot([]),

  replaceSnapshot: (snapshot) => set(snapshot),
}));

function isValidCustomCategoryInput(input: CustomCategoryInput): boolean {
  const trimmedName = input.name.trim();
  return (
    trimmedName.length >= MIN_NAME_LENGTH &&
    trimmedName.length <= MAX_NAME_LENGTH &&
    isCategoryIconValue(input.iconName) &&
    HEX_COLOR_REGEX.test(input.colorHex)
  );
}

function createCategoryMutations(db: AnyDb): WriteThroughMutationModule {
  return createWriteThroughMutationModule(db);
}

function buildCustomCategoryRow(userId: UserId, input: CustomCategoryInput): UserCategoryRow {
  const now = toIsoDateTime(new Date());
  return {
    id: generateUserCategoryId(),
    userId,
    name: input.name.trim(),
    iconName: normalizeCategoryEmoji(input.iconName) || input.iconName,
    colorHex: input.colorHex,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function buildCategoryIconOverrideRow(
  userId: UserId,
  input: CategoryEmojiInput
): CategoryIconOverrideRow {
  const now = toIsoDateTime(new Date());
  return {
    id: generateCategoryIconOverrideId(),
    userId,
    categoryId: input.categoryId,
    emoji: normalizeCategoryEmoji(input.emoji),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function buildCategoryColorOverrideRow(
  userId: UserId,
  input: CategoryColorInput
): CategoryColorOverrideRow {
  const now = toIsoDateTime(new Date());
  return {
    id: generateCategoryColorOverrideId(),
    userId,
    categoryId: input.categoryId,
    colorHex: input.colorHex,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

async function saveCustomCategory(
  mutations: WriteThroughMutationModule,
  row: UserCategoryRow
): Promise<boolean> {
  return commitCategoryMutation(mutations, { kind: "category.save", row });
}

async function commitCategoryMutation(
  mutations: WriteThroughMutationModule,
  command: Parameters<WriteThroughMutationModule["commit"]>[0]
): Promise<boolean> {
  return (await mutations.commit(command)).success;
}

async function saveCategoryIconOverride(
  mutations: WriteThroughMutationModule,
  row: CategoryIconOverrideRow
): Promise<boolean> {
  return commitCategoryMutation(mutations, { kind: "categoryIconOverride.save", row });
}

async function clearSavedCategoryOverride(
  mutations: WriteThroughMutationModule,
  kind: "categoryIconOverride.clear" | "categoryColorOverride.clear",
  input: { readonly userId: UserId; readonly categoryId: CategoryId }
): Promise<boolean> {
  return commitCategoryMutation(mutations, {
    kind,
    userId: input.userId,
    categoryId: input.categoryId,
    now: toIsoDateTime(new Date()),
  });
}

async function saveCategoryColorOverride(
  mutations: WriteThroughMutationModule,
  row: CategoryColorOverrideRow
): Promise<boolean> {
  return commitCategoryMutation(mutations, { kind: "categoryColorOverride.save", row });
}

function hasKnownCategory(categoryId: CategoryId): boolean {
  const { builtIn, custom } = useCategoriesStore.getState();
  return [...builtIn, ...custom].some((category) => category.id === categoryId);
}

function isValidCategoryAppearanceInput(input: CategoryAppearanceInput): boolean {
  return (
    normalizeCategoryEmoji(input.emoji).length > 0 &&
    HEX_COLOR_REGEX.test(input.colorHex) &&
    hasKnownCategory(input.categoryId)
  );
}

export async function refreshCategories(db: AnyDb, userId: UserId): Promise<void> {
  try {
    const rows = getUserCategoriesForUser(db, userId).map(toCustomCategoryRow);
    const iconOverrides = getCategoryIconOverridesForUser(db, userId).map(
      toCategoryIconOverrideRow
    );
    const colorOverrides = getCategoryColorOverridesForUser(db, userId).map(
      toCategoryColorOverrideRow
    );
    useCategoriesStore
      .getState()
      .replaceSnapshot(createCategoryRegistrySnapshot(rows, iconOverrides, colorOverrides));
  } catch {
    // keep existing state
  }
}

export async function createCustomCategory(
  db: AnyDb,
  userId: UserId,
  input: CustomCategoryInput
): Promise<boolean> {
  if (!isValidCustomCategoryInput(input)) return false;

  const didSave = await saveCustomCategory(
    createCategoryMutations(db),
    buildCustomCategoryRow(userId, input)
  );

  if (!didSave) return false;

  await refreshCategories(db, userId);
  return true;
}

export async function updateCategoryEmoji(
  db: AnyDb,
  userId: UserId,
  input: CategoryEmojiInput
): Promise<boolean> {
  const normalizedEmoji = normalizeCategoryEmoji(input.emoji);
  if (normalizedEmoji.length === 0 || !hasKnownCategory(input.categoryId)) return false;

  const didSave = await saveCategoryIconOverride(
    createCategoryMutations(db),
    buildCategoryIconOverrideRow(userId, { ...input, emoji: normalizedEmoji })
  );

  if (!didSave) return false;

  await refreshCategories(db, userId);
  return true;
}

export async function updateCategoryAppearance(
  db: AnyDb,
  userId: UserId,
  input: CategoryAppearanceInput
): Promise<boolean> {
  if (!isValidCategoryAppearanceInput(input)) return false;

  const mutations = createCategoryMutations(db);
  const normalizedEmoji = normalizeCategoryEmoji(input.emoji);
  const outcomes = await mutations.commitBatch([
    {
      kind: "categoryIconOverride.save",
      row: buildCategoryIconOverrideRow(userId, {
        categoryId: input.categoryId,
        emoji: normalizedEmoji,
      }),
    },
    {
      kind: "categoryColorOverride.save",
      row: buildCategoryColorOverrideRow(userId, input),
    },
  ]);

  if (!outcomes.every((outcome) => outcome.success)) return false;

  await refreshCategories(db, userId);
  return true;
}

export async function resetCategoryEmoji(
  db: AnyDb,
  userId: UserId,
  categoryId: CategoryId
): Promise<boolean> {
  if (!hasKnownCategory(categoryId)) return false;

  const didClear = await clearSavedCategoryOverride(
    createCategoryMutations(db),
    "categoryIconOverride.clear",
    {
      userId,
      categoryId,
    }
  );

  if (!didClear) return false;

  await refreshCategories(db, userId);
  return true;
}

export async function updateCategoryColor(
  db: AnyDb,
  userId: UserId,
  input: CategoryColorInput
): Promise<boolean> {
  if (!HEX_COLOR_REGEX.test(input.colorHex) || !hasKnownCategory(input.categoryId)) return false;

  const didSave = await saveCategoryColorOverride(
    createCategoryMutations(db),
    buildCategoryColorOverrideRow(userId, input)
  );

  if (!didSave) return false;

  await refreshCategories(db, userId);
  return true;
}

export async function resetCategoryColor(
  db: AnyDb,
  userId: UserId,
  categoryId: CategoryId
): Promise<boolean> {
  if (!hasKnownCategory(categoryId)) return false;

  const didClear = await clearSavedCategoryOverride(
    createCategoryMutations(db),
    "categoryColorOverride.clear",
    {
      userId,
      categoryId,
    }
  );

  if (!didClear) return false;

  await refreshCategories(db, userId);
  return true;
}
