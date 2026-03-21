import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(__dirname, "../../features/budget/components/BudgetListScreen.tsx"),
  "utf8"
);

describe("BudgetListScreen banner wiring", () => {
  it("imports BudgetAlertBanner", () => {
    expect(src).toMatch(/BudgetAlertBanner/);
  });

  it("reads pendingAlerts from store", () => {
    expect(src).toMatch(/pendingAlerts/);
  });

  it("reads acknowledgeAlert from store", () => {
    expect(src).toMatch(/acknowledgeAlert/);
  });

  it("maps pendingAlerts to banners", () => {
    expect(src).toMatch(/pendingAlerts\.map/);
  });

  it("renders banners before BudgetSummaryCard", () => {
    const bannerPos = src.indexOf("BudgetAlertBanner");
    const summaryPos = src.indexOf("BudgetSummaryCard");
    expect(bannerPos).toBeGreaterThan(0);
    expect(bannerPos).toBeLessThan(summaryPos);
  });
});
