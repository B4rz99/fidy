import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  CATEGORY_IDS,
  DEFAULT_CATEGORY_IDS,
  isValidCategoryId,
} from "../../features/transactions/lib/categories";

describe("categories", () => {
  it("exports exactly 10 categories", () => {
    expect(CATEGORIES).toHaveLength(10);
    expect(CATEGORY_IDS).toHaveLength(10);
  });

  it("contains the expected category IDs", () => {
    expect(CATEGORY_IDS).toEqual([
      "food",
      "transport",
      "entertainment",
      "health",
      "education",
      "home",
      "clothing",
      "services",
      "transfer",
      "other",
    ]);
  });

  it("each category has localized labels", () => {
    for (const category of CATEGORIES) {
      expect(category.label).toHaveProperty("en");
      expect(category.label).toHaveProperty("es");
      expect(category.label.en).toBeTruthy();
      expect(category.label.es).toBeTruthy();
    }
  });

  describe("isValidCategoryId", () => {
    it("returns true for all 10 built-in category IDs", () => {
      for (const id of CATEGORY_IDS) {
        expect(isValidCategoryId(id)).toBe(true);
      }
    });

    it("returns false for unknown string", () => {
      expect(isValidCategoryId("groceries")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidCategoryId("")).toBe(false);
    });

    it("accepts custom validIds set when provided", () => {
      const custom = new Set(["custom-a", "custom-b"]);
      expect(isValidCategoryId("custom-a", custom)).toBe(true);
      expect(isValidCategoryId("custom-b", custom)).toBe(true);
    });

    it("returns false for built-in ID when custom set excludes it", () => {
      const custom = new Set(["only-this"]);
      expect(isValidCategoryId("food", custom)).toBe(false);
    });
  });

  it("DEFAULT_CATEGORY_IDS matches CATEGORY_IDS", () => {
    expect(DEFAULT_CATEGORY_IDS.size).toBe(CATEGORY_IDS.length);
    for (const id of CATEGORY_IDS) {
      expect(DEFAULT_CATEGORY_IDS.has(id)).toBe(true);
    }
  });
});
