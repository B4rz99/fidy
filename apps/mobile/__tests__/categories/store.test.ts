// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUserCategoriesForUser, insertUserCategory } from "@/features/categories/lib/repository";
import { CATEGORIES, CATEGORY_ROWS } from "@/features/transactions/lib/categories";
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

  async function loadCategoriesModule() {
    return import("@/features/categories/store");
  }

  it("exposes built-in and merged snapshots before refresh", async () => {
    const { useCategoriesStore: store } = await loadCategoriesModule();
    const state = store.getState();

    expect(state.builtIn).toEqual(CATEGORIES);
    expect(state.custom).toEqual([]);
    expect(state.merged).toEqual(CATEGORIES);
    expect(state.builtInRows).toEqual(CATEGORY_ROWS);
    expect(state.byId.get("food")).toEqual(CATEGORIES[0]);
  });

  it("isValid defaults to built-in scope", async () => {
    const { useCategoriesStore: store } = await loadCategoriesModule();
    const state = store.getState();

    expect(state.isValid("food")).toBe(true);
    expect(state.isValid("transport")).toBe(true);
    expect(state.isValid("nonexistent")).toBe(false);
  });

  it("refresh loads user categories into the merged registry only", async () => {
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

    const { refreshCategories, useCategoriesStore: store } = await loadCategoriesModule();
    await refreshCategories(mockDb, "user-1" as UserId);

    const state = store.getState();
    expect(state.custom).toHaveLength(1);
    expect(state.merged).toHaveLength(CATEGORIES.length + 1);
    expect(state.merged.slice(0, CATEGORIES.length)).toEqual(CATEGORIES);
    expect(state.byId.get("ucat-custom-1")).toMatchObject({
      label: { en: "Groceries", es: "Groceries" },
      color: "#FF5722",
    });
    expect(state.isValid("ucat-custom-1")).toBe(false);
    expect(state.isValid("ucat-custom-1", "merged")).toBe(true);
  });

  it("createCustom inserts to DB and enqueues sync", async () => {
    vi.mocked(getUserCategoriesForUser).mockReturnValue([]);
    vi.mocked(insertUserCategory).mockReturnValue(undefined);

    const { createCustomCategory } = await loadCategoriesModule();
    const result = await createCustomCategory(mockDb, "user-1" as UserId, {
      name: "Groceries",
      iconName: "ShoppingCart",
      colorHex: "#4CAF50",
    });

    expect(result).toBe(true);
    expect(insertUserCategory).toHaveBeenCalledOnce();
    expect(enqueueSync).toHaveBeenCalledOnce();
  });

  it("createCustom returns false when name is too short", async () => {
    const { createCustomCategory } = await loadCategoriesModule();
    const result = await createCustomCategory(mockDb, "user-1" as UserId, {
      name: "A",
      iconName: "Zap",
      colorHex: "#FF0000",
    });

    expect(result).toBe(false);
    expect(insertUserCategory).not.toHaveBeenCalled();
  });

  it("createCustom returns false when name is too long", async () => {
    const { createCustomCategory } = await loadCategoriesModule();
    const result = await createCustomCategory(mockDb, "user-1" as UserId, {
      name: "A".repeat(33),
      iconName: "Zap",
      colorHex: "#FF0000",
    });

    expect(result).toBe(false);
    expect(insertUserCategory).not.toHaveBeenCalled();
  });

  it("createCustom returns false when the icon is invalid", async () => {
    const { createCustomCategory } = await loadCategoriesModule();
    const result = await createCustomCategory(mockDb, "user-1" as UserId, {
      name: "Test",
      iconName: "UnknownIcon",
      colorHex: "#FF0000",
    });

    expect(result).toBe(false);
    expect(insertUserCategory).not.toHaveBeenCalled();
  });
});
