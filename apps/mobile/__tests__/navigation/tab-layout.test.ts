import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Tab layout", () => {
  const layoutSource = readFileSync(resolve(__dirname, "../../app/(tabs)/_layout.tsx"), "utf-8");
  const primaryStackLayoutSources = [
    "../../app/(tabs)/(index)/_layout.tsx",
    "../../app/(tabs)/(ai)/_layout.tsx",
    "../../app/(tabs)/add/_layout.tsx",
    "../../app/(tabs)/(finance)/_layout.tsx",
  ].map((path) => readFileSync(resolve(__dirname, path), "utf-8"));

  test("does not include a history tab screen", () => {
    expect(layoutSource).not.toContain('name="history"');
  });

  test("has four primary tabs and no settings tab", () => {
    const expectedTabs = ["(index)", "(ai)", "add", "(finance)"];

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

  test("uses the profile avatar as the settings entry point", () => {
    expect(primaryStackLayoutSources).toHaveLength(4);
    for (const stackLayoutSource of primaryStackLayoutSources) {
      expect(stackLayoutSource).toContain("ProfileAvatarButton");
      expect(stackLayoutSource).toContain("headerLeft");
    }
  });

  test("settings is a pushed route instead of a tab route", () => {
    const settingsRouteSource = readFileSync(resolve(__dirname, "../../app/settings.tsx"), "utf-8");

    expect(settingsRouteSource).toContain("SettingsScreen");
    expect(layoutSource).not.toContain("tabs.settings");
  });

  test("does not include a standalone goals tab", () => {
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
