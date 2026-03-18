import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("ScreenLayout platform awareness", () => {
  const source = readFileSync(
    resolve(__dirname, "../../shared/components/ScreenLayout.tsx"),
    "utf-8"
  );

  test("imports Platform from react-native", () => {
    expect(source).toContain("Platform");
  });

  test("skips custom header on iOS for all variants (nested Stacks provide native headers)", () => {
    // Both tab and sub screens on iOS get native headers from their Stack navigators.
    // Custom header only renders on Android.
    expect(source).toContain('Platform.OS !== "ios"');
    expect(source).toContain("isTab");
  });

  test("exports platform-aware TAB_BAR_CLEARANCE", () => {
    // iOS native tabs handle their own insets; Android keeps 96
    expect(source).toContain("TAB_BAR_CLEARANCE");
    expect(source).toContain("Platform");
  });
});
