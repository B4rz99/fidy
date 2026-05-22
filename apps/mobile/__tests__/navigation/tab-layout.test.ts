import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Tab layout", () => {
  const layoutSource = readFileSync(resolve(__dirname, "../../app/(tabs)/_layout.tsx"), "utf-8");
  const primaryStackLayoutSources = [
    "../../app/(tabs)/(index)/_layout.tsx",
    "../../app/(tabs)/(ai)/_layout.tsx",
    "../../app/(tabs)/(budget)/_layout.tsx",
    "../../app/(tabs)/add/_layout.tsx",
    "../../app/(tabs)/(finance)/_layout.tsx",
  ].map((path) => readFileSync(resolve(__dirname, path), "utf-8"));

  test("does not include a history tab screen", () => {
    expect(layoutSource).not.toContain('name="history"');
  });

  test("has five primary tabs including budget and no settings tab", () => {
    const expectedTabs = ["(index)", "(ai)", "add", "(budget)", "(finance)"];

    const iosMatch = layoutSource.match(/function\s+IosTabs\b[\s\S]*?^}/m);
    expect(iosMatch).not.toBeNull();
    const iosNames = Array.from(iosMatch![0].matchAll(/name="([^"]+)"/g), (m) => m[1]);
    expect(iosNames).toEqual(expectedTabs);

    const androidMatch = layoutSource.match(/function\s+AndroidTabs\b[\s\S]*?^}/m);
    expect(androidMatch).not.toBeNull();
    const androidNames = Array.from(androidMatch![0].matchAll(/name="([^"]+)"/g), (m) => m[1]);
    expect(androidNames).toEqual(expectedTabs);
    expect(layoutSource).not.toContain('name="(menu)"');
  });

  test("keeps the profile avatar owned by the home screen content", () => {
    expect(primaryStackLayoutSources).toHaveLength(5);
    const [homeSource, aiSource, budgetSource, addSource, financeSource] =
      primaryStackLayoutSources;
    const homeContentSource = readFileSync(
      resolve(__dirname, "../../features/dashboard/components/home-screen/HomeScreenContent.tsx"),
      "utf-8"
    );

    expect(homeSource).not.toContain("ProfileAvatarButton");
    expect(homeContentSource).toContain("ProfileAvatarButton");
    expect(homeContentSource).toContain("leftAction");
    expect(aiSource).not.toContain("ProfileAvatarButton");
    expect(budgetSource).not.toContain("ProfileAvatarButton");
    expect(addSource).not.toContain("ProfileAvatarButton");
    expect(financeSource).not.toContain("ProfileAvatarButton");
  });

  test("removes native header shadows from visible tab headers", () => {
    const [homeSource, , , , financeSource] = primaryStackLayoutSources;

    expect(homeSource).toContain("headerShown: false");
    expect(financeSource).toContain('headerTransparent: Platform.OS === "ios"');
    expect(financeSource).toContain("headerShadowVisible: false");
  });

  test("settings is a pushed route instead of a tab route", () => {
    const settingsRouteSource = readFileSync(resolve(__dirname, "../../app/settings.tsx"), "utf-8");

    expect(settingsRouteSource).toContain("SettingsScreen");
    expect(layoutSource).not.toContain("tabs.settings");
  });

  test("does not include a standalone goals tab", () => {
    expect(layoutSource).not.toContain('name="goals"');
  });

  test("finance screen no longer owns the budget panel", () => {
    const financeSource = readFileSync(
      resolve(__dirname, "../../app/(tabs)/(finance)/index.tsx"),
      "utf-8"
    );

    expect(financeSource).not.toContain("BudgetListScreen");
    expect(financeSource).not.toContain('"budgets"');
    expect(financeSource).not.toContain('t("budgets.title")');
  });

  test("finance segment defaults to analytics and orders goals before calendar", () => {
    const financeSource = readFileSync(
      resolve(__dirname, "../../app/(tabs)/(finance)/index.tsx"),
      "utf-8"
    );

    expect(financeSource).toContain('useState<FinanceTab>("analytics")');
    const analyticsIndex = financeSource.indexOf('{ key: "analytics"');
    const goalsIndex = financeSource.indexOf('{ key: "goals"');
    const calendarIndex = financeSource.indexOf('{ key: "calendar"');

    expect(analyticsIndex).toBeGreaterThanOrEqual(0);
    expect(goalsIndex).toBeGreaterThanOrEqual(0);
    expect(calendarIndex).toBeGreaterThanOrEqual(0);
    expect(analyticsIndex).toBeLessThan(goalsIndex);
    expect(goalsIndex).toBeLessThan(calendarIndex);
  });

  test("does not reference MenuPanel", () => {
    expect(layoutSource).not.toContain("MenuPanel");
  });

  test("uses NativeTabs for iOS", () => {
    expect(layoutSource).toContain("NativeTabs");
  });

  test("uses CustomTabBar for Android", () => {
    expect(layoutSource).toContain("CustomTabBar");
  });

  test("add tab is a regular screen (no interception)", () => {
    expect(layoutSource).not.toContain("preventDefault");
    expect(layoutSource).not.toContain("ADD_TAB_PREFIX");
  });
});
