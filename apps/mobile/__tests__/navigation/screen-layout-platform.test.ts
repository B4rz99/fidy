import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function findTsxFiles(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) return findTsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

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

  test("uses iOS native headers for default sub screens and opted-in tab center actions", () => {
    expect(source).toContain(
      'const usesNativeHeader = includesNativeHeader ?? (Platform.OS === "ios" && !isTab)'
    );
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
    expect(headerBackButtonSource).toContain('backgroundColor: "transparent"');
    expect(headerBackButtonSource).toContain("borderWidth: 0");
    expect(headerBackButtonSource).toContain("backButtonPressed");
    expect(headerBackButtonSource).not.toContain("GlassPressable");
    expect(headerBackButtonSource).not.toContain("borderColor");
    expect(headerBackButtonSource).not.toContain("shadowColor");
    expect(headerBackButtonSource).not.toContain("shadowOpacity");
    expect(headerBackButtonSource).not.toContain("shadowRadius");
  });

  test("custom ScreenLayout screens do not re-enable native header back controls", () => {
    const appFiles = findTsxFiles(resolve(__dirname, "../../app"));
    const featureFiles = findTsxFiles(resolve(__dirname, "../../features"));
    const screenLayoutFiles = [...appFiles, ...featureFiles].filter((file) => {
      const source = readFileSync(file, "utf-8");
      return source.includes("<ScreenLayout") && source.includes("<Stack.Screen");
    });

    const unsafeFiles = screenLayoutFiles.filter((file) => {
      const source = readFileSync(file, "utf-8");
      return !source.includes("headerShown: false") && !source.includes("includesNativeHeader");
    });

    expect(unsafeFiles).toEqual([]);
  });
});
