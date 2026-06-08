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
      color: "#FF5722",
    });
  });
});
