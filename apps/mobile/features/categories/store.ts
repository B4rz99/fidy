import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import { generateSyncQueueId, generateUserCategoryId, toIsoDateTime } from "@/shared/lib";
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
import { getUserCategoriesForUser, insertUserCategory } from "./lib/repository";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

type CategoriesState = CategoryRegistrySnapshot;

type CategoriesActions = {
  initStore(db: AnyDb, userId: UserId): void;
  refresh(): Promise<void>;
  createCustom(input: { name: string; iconName: string; colorHex: string }): Promise<boolean>;
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

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
  },

  refresh: async () => {
    const db = dbRef;
    const userId = userIdRef;
    if (!db || !userId) return;

    try {
      const rows = getUserCategoriesForUser(db, userId).map(toCustomCategoryRow);
      set(createCategoryRegistrySnapshot(rows));
    } catch {
      // keep existing state
    }
  },

  createCustom: async (input) => {
    const db = dbRef;
    const userId = userIdRef;
    if (!db || !userId) return false;

    const trimmedName = input.name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) return false;
    if (!Object.hasOwn(ICON_MAP, input.iconName)) return false;
    if (!HEX_COLOR_REGEX.test(input.colorHex)) return false;

    const now = toIsoDateTime(new Date());
    const id = generateUserCategoryId();

    try {
      db.transaction((tx) => {
        insertUserCategory(tx as AnyDb, {
          id,
          userId,
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

    await get().refresh();
    return true;
  },

  isValid: (id, scope = "built_in") => isCategoryIdValid(get(), id, scope),
}));
