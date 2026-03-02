import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  CATEGORY_ROW_KEYS,
  CATEGORY_ROWS,
} from "@/features/transactions/lib/categories";

describe("CATEGORY_ROWS", () => {
  it("splits categories into 2 rows", () => {
    expect(CATEGORY_ROWS).toHaveLength(2);
  });

  it("first row has 3 categories", () => {
    expect(CATEGORY_ROWS[0]).toHaveLength(3);
  });

  it("second row has 3 categories", () => {
    expect(CATEGORY_ROWS[1]).toHaveLength(3);
  });

  it("contains all category IDs from CATEGORIES", () => {
    const rowIds = CATEGORY_ROWS.flat().map((c) => c.id);
    const allIds = CATEGORIES.map((c) => c.id);
    expect(rowIds).toEqual(allIds);
  });
});

describe("CATEGORY_ROW_KEYS", () => {
  it("produces dash-joined id strings for each row", () => {
    expect(CATEGORY_ROW_KEYS[0]).toBe("food-transport-shopping");
    expect(CATEGORY_ROW_KEYS[1]).toBe("bills-income-other");
  });
});
