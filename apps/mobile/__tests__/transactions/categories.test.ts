import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_IDS } from "../../features/transactions/lib/categories";

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
});
