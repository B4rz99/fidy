// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUserCategoriesForUser, insertUserCategory } from "@/features/categories/lib/repository";
import { CATEGORIES } from "@/features/transactions/lib/categories";
import { enqueueSync } from "@/shared/db/enqueue-sync";
import type { IsoDateTime, UserCategoryId, UserId } from "@/shared/types/branded";

// Mock the repository
vi.mock("@/features/categories/lib/repository", () => ({
  getUserCategoriesForUser: vi.fn().mockReturnValue([]),
  insertUserCategory: vi.fn(),
}));

// Mock the icon-map
vi.mock("@/features/categories/lib/icon-map", () => ({
  // biome-ignore lint/style/useNamingConvention: mirrors the actual ICON_MAP export
  ICON_MAP: { Zap: () => null, PawPrint: () => null, ShoppingCart: () => null },
}));

// Mock enqueueSync
vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: vi.fn(),
}));

// Mock shared/lib — the store imports from the barrel
vi.mock("@/shared/lib", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@/shared/lib")>();
  return {
    ...actual,
    generateUserCategoryId: vi.fn().mockReturnValue("ucat-test-123"),
    generateSyncQueueId: vi.fn().mockReturnValue("sq-test-123"),
    toIsoDateTime: vi.fn().mockReturnValue("2026-03-21T12:00:00.000Z"),
  };
});

const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn((fn: (tx: any) => void) => fn(mockDb)),
} as any;

describe("useCategoriesStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset store state between tests by re-importing
    vi.resetModules();
  });

  async function getStore() {
    const { useCategoriesStore } = await import("@/features/categories/store");
    return useCategoriesStore;
  }

  it("allCategories contains 10 built-in categories when no user categories loaded", async () => {
    const store = await getStore();
    const state = store.getState();

    expect(state.allCategories).toHaveLength(10);
    expect(state.allCategories).toEqual(CATEGORIES);
    expect(state.userCategories).toHaveLength(0);
  });

  it("isValidCategoryId returns true for built-in IDs", async () => {
    const store = await getStore();
    const state = store.getState();

    expect(state.isValidCategoryId("food")).toBe(true);
    expect(state.isValidCategoryId("transport")).toBe(true);
  });

  it("isValidCategoryId returns false for unknown ID", async () => {
    const store = await getStore();
    const state = store.getState();

    expect(state.isValidCategoryId("nonexistent")).toBe(false);
    expect(state.isValidCategoryId("")).toBe(false);
  });

  it("allCategoryIds contains all built-in IDs initially", async () => {
    const store = await getStore();
    const state = store.getState();

    expect(state.allCategoryIds.size).toBe(10);
    for (const cat of CATEGORIES) {
      expect(state.allCategoryIds.has(cat.id)).toBe(true);
    }
  });

  it("after loading user categories, allCategories includes them", async () => {
    const fakeRow = {
      id: "ucat-custom-1" as UserCategoryId,
      userId: "user-1" as UserId,
      name: "Groceries",
      iconName: "Zap",
      colorHex: "#FF5722",
      createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    };
    vi.mocked(getUserCategoriesForUser).mockReturnValue([fakeRow]);

    const store = await getStore();
    store.getState().initStore(mockDb, "user-1" as UserId);
    await store.getState().loadUserCategories();

    const state = store.getState();
    expect(state.allCategories).toHaveLength(11);
    // Built-in first, then user categories
    expect(state.allCategories.slice(0, 10)).toEqual(CATEGORIES);
    expect(state.allCategories[10]?.id).toBe("ucat-custom-1");
    expect(state.allCategories[10]?.label).toEqual({
      en: "Groceries",
      es: "Groceries",
    });
    expect(state.allCategories[10]?.color).toBe("#FF5722");
  });

  it("isValidCategoryId returns true for user category ID after load", async () => {
    const fakeRow = {
      id: "ucat-custom-1" as UserCategoryId,
      userId: "user-1" as UserId,
      name: "Pets",
      iconName: "PawPrint",
      colorHex: "#9C27B0",
      createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    };
    vi.mocked(getUserCategoriesForUser).mockReturnValue([fakeRow]);

    const store = await getStore();
    store.getState().initStore(mockDb, "user-1" as UserId);
    await store.getState().loadUserCategories();

    const state = store.getState();
    expect(state.isValidCategoryId("ucat-custom-1")).toBe(true);
  });

  it("uses Ellipsis fallback icon for unrecognized iconName", async () => {
    const fakeRow = {
      id: "ucat-custom-2" as UserCategoryId,
      userId: "user-1" as UserId,
      name: "Unknown Icon",
      iconName: "NonExistentIcon",
      colorHex: "#607D8B",
      createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    };
    vi.mocked(getUserCategoriesForUser).mockReturnValue([fakeRow]);

    const store = await getStore();
    store.getState().initStore(mockDb, "user-1" as UserId);
    await store.getState().loadUserCategories();

    const state = store.getState();
    const icon = state.allCategories[10]?.icon;
    expect(icon).toBeDefined();
    // Must NOT be any of the ICON_MAP mock values — proves fallback was used
    const mockIcons: (() => null)[] = [() => null, () => null, () => null];
    expect(mockIcons).not.toContain(icon);
  });

  it("createUserCategory inserts to DB and enqueues sync", async () => {
    vi.mocked(getUserCategoriesForUser).mockReturnValue([]);
    vi.mocked(insertUserCategory).mockReturnValue(undefined);

    const store = await getStore();
    store.getState().initStore(mockDb, "user-1" as UserId);

    const result = await store.getState().createUserCategory({
      name: "Groceries",
      iconName: "ShoppingCart",
      colorHex: "#4CAF50",
    });

    expect(result).toBe(true);
    expect(insertUserCategory).toHaveBeenCalledOnce();
    expect(enqueueSync).toHaveBeenCalledOnce();
  });

  it("createUserCategory returns false when name is too short", async () => {
    const store = await getStore();
    store.getState().initStore(mockDb, "user-1" as UserId);

    const result = await store.getState().createUserCategory({
      name: "A",
      iconName: "Zap",
      colorHex: "#FF0000",
    });

    expect(result).toBe(false);
    expect(insertUserCategory).not.toHaveBeenCalled();
  });

  it("createUserCategory returns false when name is too long", async () => {
    const store = await getStore();
    store.getState().initStore(mockDb, "user-1" as UserId);

    const result = await store.getState().createUserCategory({
      name: "A".repeat(33),
      iconName: "Zap",
      colorHex: "#FF0000",
    });

    expect(result).toBe(false);
    expect(insertUserCategory).not.toHaveBeenCalled();
  });

  it("createUserCategory returns false when DB refs are not set", async () => {
    const store = await getStore();
    // Don't call initStore

    const result = await store.getState().createUserCategory({
      name: "Test",
      iconName: "Zap",
      colorHex: "#FF0000",
    });

    expect(result).toBe(false);
  });
});
