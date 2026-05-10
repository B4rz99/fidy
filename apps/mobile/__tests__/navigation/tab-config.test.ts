import { describe, expect, test } from "vitest";
import { TAB_CONFIG } from "@/shared/components/navigation/tab-config";

describe("TAB_CONFIG", () => {
  test("includes home, ai, and finance tab routes", () => {
    expect(TAB_CONFIG).toHaveProperty("(index)");
    expect(TAB_CONFIG).toHaveProperty("(ai)");
    expect(TAB_CONFIG).toHaveProperty("(finance)");
  });

  test("has exactly 3 configured routes", () => {
    expect(Object.keys(TAB_CONFIG)).toHaveLength(3);
  });

  test("does not include history or goals route", () => {
    expect(TAB_CONFIG).not.toHaveProperty("history");
    expect(TAB_CONFIG).not.toHaveProperty("goals");
  });

  test("has correct labels", () => {
    expect(TAB_CONFIG["(index)"]?.label).toBe("HOME");
    expect(TAB_CONFIG["(ai)"]?.label).toBe("AI");
    expect(TAB_CONFIG["(finance)"]?.label).toBe("FINANCE");
  });

  test("every entry has icon property", () => {
    for (const entry of Object.values(TAB_CONFIG)) {
      expect(entry).toHaveProperty("icon");
    }
  });
});
