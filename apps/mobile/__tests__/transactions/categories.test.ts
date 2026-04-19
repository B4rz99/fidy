import { describe, expect, it } from "vitest";
import { getBuiltInCategoryId } from "@/features/transactions";
import {
  CATEGORIES,
  CATEGORY_IDS,
  DEFAULT_CATEGORY_IDS,
  isValidCategoryId,
} from "@/features/transactions/lib/categories";

describe("categories", () => {
  it("exports exactly 9 categories", () => {
    expect(CATEGORIES).toHaveLength(9);
    expect(CATEGORY_IDS).toHaveLength(9);
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
    it("returns true for all built-in category IDs", () => {
      for (const id of CATEGORY_IDS) {
        expect(isValidCategoryId(id)).toBe(true);
      }
    });

    it("returns false for transfer", () => {
      expect(isValidCategoryId("transfer")).toBe(false);
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

describe("getBuiltInCategoryId", () => {
  it("returns the branded id for known built-in categories", () => {
    expect(getBuiltInCategoryId("services")).toBe("services");
    expect(getBuiltInCategoryId("other")).toBe("other");
  });

  it("throws for unknown built-in category keys", () => {
    expect(() => getBuiltInCategoryId("missing")).toThrow("Unknown built-in category: missing");
  });
});
