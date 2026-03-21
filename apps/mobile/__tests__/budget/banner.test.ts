import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(__dirname, "../../features/budget/components/BudgetAlertBanner.tsx"),
  "utf8"
);

describe("BudgetAlertBanner structure", () => {
  it("imports formatMoney", () => {
    expect(src).toMatch(/formatMoney/);
  });

  it("imports BudgetId branded type", () => {
    expect(src).toMatch(/BudgetId/);
  });

  it("renders category icon from CATEGORY_MAP", () => {
    expect(src).toMatch(/category\?\.icon|CategoryIcon/);
  });

  it("renders suggestion text conditionally on suggestionKey", () => {
    expect(src).toMatch(/suggestionKey/);
  });

  it("uses 32x32 icon circle", () => {
    expect(src).toMatch(/width.*32|height.*32/);
  });

  it("no longer uses TriangleAlert icon", () => {
    expect(src).not.toMatch(/TriangleAlert/);
  });
});
