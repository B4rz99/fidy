import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Tab layout", () => {
  const layoutSource = readFileSync(resolve(__dirname, "../../app/(tabs)/_layout.tsx"), "utf-8");

  test("does not include a history tab screen", () => {
    expect(layoutSource).not.toContain('name="history"');
  });

  test("has five tabs: (index), (ai), add, (budgets), (menu)", () => {
    const expectedTabs = ["(index)", "(ai)", "add", "(budgets)", "(menu)"];

    const iosMatch = layoutSource.match(/function\s+IosTabs\b[\s\S]*?^}/m);
    expect(iosMatch).not.toBeNull();
    const iosNames = Array.from(iosMatch![0].matchAll(/name="([^"]+)"/g), (m) => m[1]);
    expect(iosNames).toEqual(expectedTabs);

    const androidMatch = layoutSource.match(/function\s+AndroidTabs\b[\s\S]*?^}/m);
    expect(androidMatch).not.toBeNull();
    const androidNames = Array.from(androidMatch![0].matchAll(/name="([^"]+)"/g), (m) => m[1]);
    expect(androidNames).toEqual(expectedTabs);
  });

  test("does not include goals tab", () => {
    expect(layoutSource).not.toContain('name="goals"');
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
