import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("ScreenLayout platform awareness", () => {
  const source = readFileSync(
    resolve(__dirname, "../../shared/components/ScreenLayout.tsx"),
    "utf-8"
  );
  const headerBackButtonSource = readFileSync(
    resolve(__dirname, "../../shared/components/HeaderBackButton.tsx"),
    "utf-8"
  );

  test("imports Platform from react-native", () => {
    expect(source).toContain("Platform");
  });

  test("uses iOS native headers for tab center actions", () => {
    // Finance uses centerAction for its section switcher, so tab screens can opt into
    // the native title slot while plain tab screens still avoid duplicate headers.
    expect(source).toContain('Platform.OS !== "ios"');
    expect(source).toContain("shouldShowIosNativeHeader");
    expect(source).toContain("headerShown: shouldShowIosNativeHeader");
    expect(source).toContain("headerTitle: () => centerAction");
  });

  test("exports platform-aware TAB_BAR_CLEARANCE", () => {
    // iOS native tabs handle their own insets; Android keeps 96
    expect(source).toContain("TAB_BAR_CLEARANCE");
    expect(source).toContain("Platform");
  });

  test("renders back targets without a visible button border", () => {
    expect(headerBackButtonSource).toContain("backButton");
    expect(headerBackButtonSource).toContain("<Pressable");
    expect(headerBackButtonSource).not.toContain("GlassPressable");
    expect(headerBackButtonSource).not.toContain("borderColor");
    expect(headerBackButtonSource).not.toContain("borderWidth");
    expect(headerBackButtonSource).toContain("shadowOpacity: 0");
  });
});
