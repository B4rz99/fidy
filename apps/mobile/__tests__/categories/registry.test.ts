import { describe, expect, it } from "vitest";
import {
  createCategoryRegistrySnapshot,
  isCategoryIdValid,
} from "@/features/categories/lib/registry";
import { CATEGORIES } from "@/features/transactions/lib/categories";
import type { UserCategoryId } from "@/shared/types/branded";

describe("createCategoryRegistrySnapshot", () => {
  it("keeps built-in categories separate from merged custom categories", () => {
    const snapshot = createCategoryRegistrySnapshot([]);

    expect(snapshot.builtIn).toEqual(CATEGORIES);
    expect(snapshot.custom).toEqual([]);
    expect(snapshot.merged).toEqual(CATEGORIES);
    expect(snapshot.builtInRows).toHaveLength(2);
    expect(snapshot.byId.get("food")).toEqual(CATEGORIES[0]);
  });

  it("indexes custom categories in the merged registry only", () => {
    const customRow = {
      id: "ucat-custom-1" as UserCategoryId,
      name: "Groceries",
      iconName: "NonExistentIcon",
      colorHex: "#FF5722",
    };

    const snapshot = createCategoryRegistrySnapshot([customRow]);

    expect(snapshot.custom).toHaveLength(1);
    expect(snapshot.merged).toHaveLength(CATEGORIES.length + 1);
    expect(snapshot.builtInRows).toHaveLength(2);
    expect(snapshot.byId.get("ucat-custom-1")).toMatchObject({
      label: { en: "Groceries", es: "Groceries" },
      color: "#FF5722",
    });
  });
});

describe("isCategoryIdValid", () => {
  it("respects the requested scope", () => {
    const builtInOnly = createCategoryRegistrySnapshot([]);
    const merged = createCategoryRegistrySnapshot([
      {
        id: "ucat-custom-1" as UserCategoryId,
        name: "Groceries",
        iconName: "Zap",
        colorHex: "#FF5722",
      },
    ]);

    expect(isCategoryIdValid(builtInOnly, "food", "built_in")).toBe(true);
    expect(isCategoryIdValid(builtInOnly, "ucat-custom-1", "built_in")).toBe(false);
    expect(isCategoryIdValid(merged, "ucat-custom-1", "merged")).toBe(true);
  });
});
