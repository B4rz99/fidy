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

  test("uses custom solid headers without native header options", () => {
    expect(source).toContain('Platform.OS !== "ios"');
    expect(source).not.toContain("headerTransparent");
    expect(source).not.toContain("headerTitle: () => centerAction");
    expect(source).not.toContain("<Stack.Screen");
  });

  test("exports platform-aware TAB_BAR_CLEARANCE", () => {
    // iOS native tabs handle their own insets; Android keeps 96
    expect(source).toContain("TAB_BAR_CLEARANCE");
    expect(source).toContain("Platform");
  });

  test("renders back targets with the shared solid action button", () => {
    expect(headerBackButtonSource).toContain("IconActionButton");
    expect(headerBackButtonSource).toContain('tone="surface"');
    expect(headerBackButtonSource).toContain('size="size-11"');
    expect(headerBackButtonSource).not.toContain('backgroundColor: "transparent"');
    expect(headerBackButtonSource).not.toContain("shadowColor");
    expect(headerBackButtonSource).not.toContain("shadowOpacity");
    expect(headerBackButtonSource).not.toContain("shadowRadius");
  });

  test("custom ScreenLayout screens do not configure native header back controls", () => {
    const appFiles = findTsxFiles(resolve(__dirname, "../../app"));
    const featureFiles = findTsxFiles(resolve(__dirname, "../../features"));
    const screenLayoutFiles = [...appFiles, ...featureFiles].filter((file) => {
      const source = readFileSync(file, "utf-8");
      return source.includes("<ScreenLayout") && source.includes("<Stack.Screen");
    });

    expect(screenLayoutFiles).toEqual([]);
  });
});
