import { create } from "zustand";
import { CATEGORIES, type Category } from "@/features/transactions/lib/categories";
import { Ellipsis } from "@/shared/components/icons";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import { generateSyncQueueId, generateUserCategoryId, toIsoDateTime } from "@/shared/lib";
import type { CategoryId, UserId } from "@/shared/types/branded";
import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from "./lib/constants";
import { ICON_MAP } from "./lib/icon-map";
import { getUserCategoriesForUser, insertUserCategory } from "./lib/repository";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

type CategoriesState = {
  userCategories: Category[];
  allCategories: readonly Category[];
  allCategoryIds: ReadonlySet<string>;
};

type CategoriesActions = {
  initStore(db: AnyDb, userId: UserId): void;
  loadUserCategories(): Promise<void>;
  createUserCategory(input: { name: string; iconName: string; colorHex: string }): Promise<boolean>;
  isValidCategoryId(id: string): boolean;
};

const toCategory = (row: {
  id: string;
  name: string;
  iconName: string;
  colorHex: string;
}): Category => ({
  // UserCategoryId and CategoryId are both Brand<string, _>; cast via string is safe since allCategoryIds operates on plain strings
  id: row.id as string as CategoryId,
  label: { en: row.name, es: row.name },
  icon: ICON_MAP[row.iconName] ?? Ellipsis,
  color: row.colorHex,
});

export const useCategoriesStore = create<CategoriesState & CategoriesActions>((set, get) => ({
  userCategories: [],
  allCategories: CATEGORIES,
  allCategoryIds: new Set(CATEGORIES.map((c) => c.id)),

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
  },

  loadUserCategories: async () => {
    const db = dbRef;
    if (!db || !userIdRef) return;

    try {
      const rows = getUserCategoriesForUser(db, userIdRef);
      const converted = rows.map(toCategory);
      const all = [...CATEGORIES, ...converted];
      set({
        userCategories: converted,
        allCategories: all,
        allCategoryIds: new Set(all.map((c) => c.id)),
      });
    } catch {
      // keep existing state
    }
  },

  createUserCategory: async (input) => {
    if (!dbRef || !userIdRef) return false;

    const trimmedName = input.name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) return false;
    if (!Object.hasOwn(ICON_MAP, input.iconName)) return false;
    if (!HEX_COLOR_REGEX.test(input.colorHex)) return false;

    const now = toIsoDateTime(new Date());
    const id = generateUserCategoryId();

    try {
      dbRef.transaction((tx) => {
        insertUserCategory(tx as AnyDb, {
          id,
          userId: userIdRef!,
          name: trimmedName,
          iconName: input.iconName,
          colorHex: input.colorHex,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });

        enqueueSync(tx as AnyDb, {
          id: generateSyncQueueId(),
          tableName: "userCategories",
          rowId: id,
          operation: "insert",
          createdAt: now,
        });
      });
    } catch {
      return false;
    }

    await get().loadUserCategories();
    return true;
  },

  isValidCategoryId: (id) => get().allCategoryIds.has(id),
}));
