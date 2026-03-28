import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Tab layout", () => {
  const layoutSource = readFileSync(
    resolve(__dirname, "../../app/(tabs)/_layout.tsx"),
    "utf-8",
  );

  test("does not include a history tab screen", () => {
    expect(layoutSource).not.toContain('name="history"');
  });

  test("uses NativeTabs on iOS and CustomTabBar on Android", () => {
    expect(layoutSource).toContain("NativeTabs");
    expect(layoutSource).toContain("CustomTabBar");
    expect(layoutSource).toContain('Platform.OS === "ios"');
  });

  test("has five tabs: (index), (ai), add, (finance), (menu)", () => {
    const expectedTabs = ["(index)", "(ai)", "add", "(finance)", "(menu)"];
    for (const tab of expectedTabs) {
      expect(layoutSource).toContain(`name="${tab}"`);
    }
  });

  test("does not include a standalone goals tab", () => {
    expect(layoutSource).not.toContain('name="goals"');
  });

  test("does not reference MenuPanel", () => {
    expect(layoutSource).not.toContain("MenuPanel");
  });

  test("add tab is a regular screen (no interception)", () => {
    expect(layoutSource).not.toContain("preventDefault");
    expect(layoutSource).not.toContain("ADD_TAB_PREFIX");
  });

  test("renders VoiceBottomSheet", () => {
    expect(layoutSource).toContain("VoiceBottomSheet");
  });
});
