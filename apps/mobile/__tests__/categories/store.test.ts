import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCategoryColorOverridesForUser,
  getCategoryIconOverridesForUser,
  getUserCategoriesForUser,
} from "@/features/categories/lib/repository";
import { CATEGORIES } from "@/features/transactions/lib/categories";
import {
  clearCategoryColorOverride,
  clearCategoryIconOverride,
  insertUserCategory,
  upsertCategoryColorOverride,
  upsertCategoryIconOverride,
} from "@/infrastructure/local-ledger/category-storage";
import type {
  CategoryColorOverrideId,
  CategoryIconOverrideId,
  CategoryId,
  IsoDateTime,
  UserCategoryId,
  UserId,
} from "@/shared/types/branded";

vi.mock("@/features/categories/lib/repository", () => ({
  getCategoryColorOverridesForUser: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getCategoryIconOverridesForUser: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
  getUserCategoriesForUser: vi.fn<(...args: any[]) => any>().mockReturnValue([]),
}));

vi.mock("@/infrastructure/local-ledger/category-storage", () => ({
  clearCategoryColorOverride: vi.fn<(...args: any[]) => any>(),
  clearCategoryIconOverride: vi.fn<(...args: any[]) => any>(),
  insertUserCategory: vi.fn<(...args: any[]) => any>(),
  upsertCategoryColorOverride: vi.fn<(...args: any[]) => any>(),
  upsertCategoryIconOverride: vi.fn<(...args: any[]) => any>(),
}));

// Mock the icon-map
vi.mock("@/features/categories/lib/icon-map", () => ({
  // biome-ignore lint/style/useNamingConvention: mirrors the actual ICON_MAP export
  ICON_MAP: { Zap: "⚡", PawPrint: "🐾", ShoppingCart: "🛒" },
  isCategoryIconValue: (value: string) =>
    ["Zap", "PawPrint", "ShoppingCart"].includes(value) || /[🥑🧺🧁]/u.test(value),
  normalizeCategoryEmoji: (value: string) => value.match(/[🥑🧺🧁]/u)?.[0] ?? "",
  resolveCategoryIconValue: (value: string) =>
    ({ Zap: "⚡", PawPrint: "🐾", ShoppingCart: "🛒" })[value] ??
    value.match(/[🥑🧺🧁]/u)?.[0] ??
    "✨",
}));

// Mock shared/lib - the store imports from the barrel
vi.mock("@/shared/lib", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@/shared/lib")>();
  return {
    ...actual,
    generateCategoryColorOverrideId: vi
      .fn<(...args: any[]) => any>()
      .mockReturnValue("cco-test-123"),
    generateCategoryIconOverrideId: vi
      .fn<(...args: any[]) => any>()
      .mockReturnValue("cio-test-123"),
    generateUserCategoryId: vi.fn<(...args: any[]) => any>().mockReturnValue("ucat-test-123"),
    toIsoDateTime: vi.fn<(...args: any[]) => any>().mockReturnValue("2026-03-21T12:00:00.000Z"),
  };
});

const mockDb = {
  insert: vi.fn<(...args: any[]) => any>(),
  select: vi.fn<(...args: any[]) => any>(),
  transaction: vi.fn<(...args: any[]) => any>((fn: (tx: any) => void) => fn(mockDb)),
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

  it("exposes built-in and custom snapshots before refresh", async () => {
    const { useCategoriesStore: store } = await loadCategoriesModule();
    const state = store.getState();

    expect(state.builtIn).toEqual(CATEGORIES);
    expect(state.custom).toEqual([]);
  });

  it("refresh loads user categories into the custom registry", async () => {
    const fakeRow = {
      id: "ucat-custom-1" as UserCategoryId,
      userId: "user-1" as UserId,
      name: "Groceries",
      iconName: "Zap",
      colorHex: "#FF5722",
      createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      deletedAt: null,
      source: "local_ledger" as const,
    };
    vi.mocked(getUserCategoriesForUser).mockReturnValue([fakeRow]);

    const { refreshCategories, useCategoriesStore: store } = await loadCategoriesModule();
    await refreshCategories(mockDb, "user-1" as UserId);

    const state = store.getState();
    expect(state.custom).toHaveLength(1);
    expect(state.custom[0]).toMatchObject({
      label: { en: "Groceries", es: "Groceries" },
      icon: "⚡",
      color: "#FF5722",
    });
  });

  it("refresh applies user emoji overrides to built-in and custom categories", async () => {
    const fakeRow = {
      id: "ucat-custom-1" as UserCategoryId,
      userId: "user-1" as UserId,
      name: "Groceries",
      iconName: "Zap",
      colorHex: "#FF5722",
      createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      deletedAt: null,
      source: "local_ledger" as const,
    };
    vi.mocked(getUserCategoriesForUser).mockReturnValue([fakeRow]);
    vi.mocked(getCategoryIconOverridesForUser).mockReturnValue([
      {
        id: "cio-food" as CategoryIconOverrideId,
        userId: "user-1" as UserId,
        categoryId: "food" as CategoryId,
        emoji: "🥑",
        createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        deletedAt: null,
      },
      {
        id: "cio-custom" as CategoryIconOverrideId,
        userId: "user-1" as UserId,
        categoryId: "ucat-custom-1" as CategoryId,
        emoji: "🧺",
        createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        deletedAt: null,
      },
    ]);

    const { refreshCategories, useCategoriesStore: store } = await loadCategoriesModule();
    await refreshCategories(mockDb, "user-1" as UserId);

    const state = store.getState();
    expect(state.builtIn.find((category) => category.id === "food")?.icon).toBe("🥑");
    expect(state.custom[0]?.icon).toBe("🧺");
  });

  it("refresh applies user color overrides to built-in and custom categories", async () => {
    const fakeRow = {
      id: "ucat-custom-1" as UserCategoryId,
      userId: "user-1" as UserId,
      name: "Groceries",
      iconName: "Zap",
      colorHex: "#FF5722",
      createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
      deletedAt: null,
      source: "local_ledger" as const,
    };
    vi.mocked(getUserCategoriesForUser).mockReturnValue([fakeRow]);
    vi.mocked(getCategoryColorOverridesForUser).mockReturnValue([
      {
        id: "cco-food" as CategoryColorOverrideId,
        userId: "user-1" as UserId,
        categoryId: "food" as CategoryId,
        colorHex: "#7CB243",
        createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        deletedAt: null,
      },
      {
        id: "cco-custom" as CategoryColorOverrideId,
        userId: "user-1" as UserId,
        categoryId: "ucat-custom-1" as CategoryId,
        colorHex: "#8BBAE8",
        createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
        deletedAt: null,
      },
    ]);

    const { refreshCategories, useCategoriesStore: store } = await loadCategoriesModule();
    await refreshCategories(mockDb, "user-1" as UserId);

    const state = store.getState();
    expect(state.builtIn.find((category) => category.id === "food")?.color).toBe("#7CB243");
    expect(state.custom[0]?.color).toBe("#8BBAE8");
  });

  it("createCustom inserts to DB", async () => {
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
  });

  it("createCustom accepts a keyboard emoji as the icon", async () => {
    vi.mocked(getUserCategoriesForUser).mockReturnValue([]);
    vi.mocked(insertUserCategory).mockReturnValue(undefined);

    const { createCustomCategory } = await loadCategoriesModule();
    const result = await createCustomCategory(mockDb, "user-1" as UserId, {
      name: "Desserts",
      iconName: "Postres 🧁",
      colorHex: "#4CAF50",
    });

    expect(result).toBe(true);
    expect(insertUserCategory).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        iconName: "🧁",
        name: "Desserts",
      })
    );
  });

  it("updateCategoryEmoji saves an override and refreshes categories", async () => {
    vi.mocked(upsertCategoryIconOverride).mockReturnValue(undefined);

    const { updateCategoryEmoji } = await loadCategoriesModule();
    const result = await updateCategoryEmoji(mockDb, "user-1" as UserId, {
      categoryId: "food" as CategoryId,
      emoji: "🥑",
    });

    expect(result).toBe(true);
    expect(upsertCategoryIconOverride).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        categoryId: "food",
        emoji: "🥑",
        id: "cio-test-123",
        userId: "user-1",
      })
    );
  });

  it("resetCategoryEmoji clears an override and refreshes categories", async () => {
    vi.mocked(clearCategoryIconOverride).mockReturnValue(undefined);

    const { resetCategoryEmoji } = await loadCategoriesModule();
    const result = await resetCategoryEmoji(mockDb, "user-1" as UserId, "food" as CategoryId);

    expect(result).toBe(true);
    expect(clearCategoryIconOverride).toHaveBeenCalledWith(mockDb, {
      userId: "user-1",
      categoryId: "food",
      now: "2026-03-21T12:00:00.000Z",
    });
  });

  it("updateCategoryColor saves a color override and refreshes categories", async () => {
    vi.mocked(upsertCategoryColorOverride).mockReturnValue(undefined);

    const { updateCategoryColor } = await loadCategoriesModule();
    const result = await updateCategoryColor(mockDb, "user-1" as UserId, {
      categoryId: "food" as CategoryId,
      colorHex: "#7CB243",
    });

    expect(result).toBe(true);
    expect(upsertCategoryColorOverride).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        categoryId: "food",
        colorHex: "#7CB243",
        userId: "user-1",
      })
    );
  });

  it("resetCategoryColor clears an override and refreshes categories", async () => {
    vi.mocked(clearCategoryColorOverride).mockReturnValue(undefined);

    const { resetCategoryColor } = await loadCategoriesModule();
    const result = await resetCategoryColor(mockDb, "user-1" as UserId, "food" as CategoryId);

    expect(result).toBe(true);
    expect(clearCategoryColorOverride).toHaveBeenCalledWith(mockDb, {
      userId: "user-1",
      categoryId: "food",
      now: "2026-03-21T12:00:00.000Z",
    });
  });

  it("updateCategoryAppearance saves emoji and color overrides with one refresh", async () => {
    vi.mocked(upsertCategoryIconOverride).mockReturnValue(undefined);
    vi.mocked(upsertCategoryColorOverride).mockReturnValue(undefined);
    vi.mocked(getUserCategoriesForUser).mockReturnValue([]);

    const { updateCategoryAppearance } = await loadCategoriesModule();
    const result = await updateCategoryAppearance(mockDb, "user-1" as UserId, {
      categoryId: "food" as CategoryId,
      emoji: "🥑",
      colorHex: "#7CB243",
    });

    expect(result).toBe(true);
    expect(upsertCategoryIconOverride).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        categoryId: "food",
        emoji: "🥑",
        id: "cio-test-123",
        userId: "user-1",
      })
    );
    expect(upsertCategoryColorOverride).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        categoryId: "food",
        colorHex: "#7CB243",
        id: "cco-test-123",
        userId: "user-1",
      })
    );
    expect(getUserCategoriesForUser).toHaveBeenCalledOnce();
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
