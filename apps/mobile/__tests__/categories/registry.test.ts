import { describe, expect, it } from "vitest";
import { createCategoryRegistrySnapshot } from "@/features/categories/lib/registry";
import { CATEGORIES } from "@/features/transactions/lib/categories";
import type { UserCategoryId } from "@/shared/types/branded";

describe("createCategoryRegistrySnapshot", () => {
  it("keeps built-in categories separate from merged custom categories", () => {
    const snapshot = createCategoryRegistrySnapshot([]);

    expect(snapshot.builtIn).toEqual(CATEGORIES);
    expect(snapshot.custom).toEqual([]);
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
    expect(snapshot.custom[0]).toMatchObject({
      label: { en: "Groceries", es: "Groceries" },
      icon: "✨",
      color: "#FF5722",
    });
  });

  it("uses a keyboard emoji stored on a custom category", () => {
    const customRow = {
      id: "ucat-custom-1" as UserCategoryId,
      name: "Desserts",
      iconName: "🧁",
      colorHex: "#FF5722",
    };

    const snapshot = createCategoryRegistrySnapshot([customRow]);

    expect(snapshot.custom[0]?.icon).toBe("🧁");
  });

  it("applies emoji overrides to built-in and custom categories", () => {
    const customRow = {
      id: "ucat-custom-1" as UserCategoryId,
      name: "Groceries",
      iconName: "NonExistentIcon",
      colorHex: "#FF5722",
    };

    const snapshot = createCategoryRegistrySnapshot(
      [customRow],
      [
        { categoryId: "food", emoji: "🥑" },
        { categoryId: "ucat-custom-1", emoji: "🧺" },
      ]
    );

    expect(snapshot.builtIn.find((category) => category.id === "food")?.icon).toBe("🥑");
    expect(snapshot.custom[0]?.icon).toBe("🧺");
  });
});
