import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_MAP, type CategoryId } from "@/features/transactions/lib/categories";

describe("CATEGORIES", () => {
  it("has exactly 6 categories", () => {
    expect(CATEGORIES).toHaveLength(6);
  });

  it("has all expected category ids", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(["food", "transport", "shopping", "bills", "income", "other"]);
  });

  it("every category has a label, icon, and color", () => {
    for (const cat of CATEGORIES) {
      expect(cat.label).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("CATEGORY_MAP", () => {
  it("maps every category id to its category", () => {
    const ids: CategoryId[] = ["food", "transport", "shopping", "bills", "income", "other"];
    for (const id of ids) {
      expect(CATEGORY_MAP[id]).toBeDefined();
      expect(CATEGORY_MAP[id].id).toBe(id);
    }
  });
});
