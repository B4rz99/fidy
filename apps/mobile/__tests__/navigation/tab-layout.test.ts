import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Tab layout", () => {
  const layoutSource = readFileSync(resolve(__dirname, "../../app/(tabs)/_layout.tsx"), "utf-8");

  test("does not include a history tab screen", () => {
    expect(layoutSource).not.toContain('name="history"');
  });

  test("includes add tab screen", () => {
    expect(layoutSource).toContain('name="add"');
  });

  test("has correct tab order: index, ai, add, goals, menu, calendar", () => {
    const screens = Array.from(layoutSource.matchAll(/name="(\w+)"/g), (m) => m[1]);
    expect(screens).toEqual(["index", "ai", "add", "goals", "menu", "calendar"]);
  });

  // Bug 4: pressing ADD should close menu, pressing MENU should close sheet
  test("ADD branch closes the menu overlay", () => {
    // The ADD_TAB_PREFIX branch should call closeMenu
    const addBranch = layoutSource.match(/ADD_TAB_PREFIX\)[\s\S]*?else if/);
    expect(addBranch?.[0]).toContain("closeMenu");
  });

  test("MENU branch closes the transaction sheet", () => {
    // The MENU_TAB_PREFIX branch should call closeSheet
    const menuBranch = layoutSource.match(/MENU_TAB_PREFIX\)[\s\S]*?else\b/);
    expect(menuBranch?.[0]).toContain("closeSheet");
  });
});
