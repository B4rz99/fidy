import { describe, expect, test } from "vitest";
import { CustomTabBar, TAB_CONFIG } from "@/shared/components/navigation/CustomTabBar";

describe("CustomTabBar", () => {
  test("is exported as a function", () => {
    expect(typeof CustomTabBar).toBe("function");
  });

  test("re-exports TAB_CONFIG", () => {
    expect(TAB_CONFIG).toBeDefined();
    expect(Object.keys(TAB_CONFIG)).toHaveLength(4);
  });
});
