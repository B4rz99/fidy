import { describe, expect, test } from "vitest";
import { TAB_CONFIG } from "@/shared/components/navigation/tab-config";

describe("TAB_CONFIG", () => {
  test("includes index, ai, goals, and menu routes", () => {
    expect(TAB_CONFIG).toHaveProperty("index");
    expect(TAB_CONFIG).toHaveProperty("ai");
    expect(TAB_CONFIG).toHaveProperty("goals");
    expect(TAB_CONFIG).toHaveProperty("menu");
  });

  test("has exactly 4 routes", () => {
    expect(Object.keys(TAB_CONFIG)).toHaveLength(4);
  });

  test("does not include history route", () => {
    expect(TAB_CONFIG).not.toHaveProperty("history");
  });

  test("has correct labels", () => {
    expect(TAB_CONFIG.index.label).toBe("HOME");
    expect(TAB_CONFIG.ai.label).toBe("AI");
    expect(TAB_CONFIG.goals.label).toBe("GOALS");
    expect(TAB_CONFIG.menu.label).toBe("MENU");
  });

  test("every entry has icon property", () => {
    for (const entry of Object.values(TAB_CONFIG)) {
      expect(entry).toHaveProperty("icon");
    }
  });
});
