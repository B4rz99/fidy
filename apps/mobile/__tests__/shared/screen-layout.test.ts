import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("ScreenLayout", () => {
  const source = readFileSync(
    resolve(__dirname, "../../shared/components/ScreenLayout.tsx"),
    "utf-8"
  );

  test("exports ScreenLayout as named export", () => {
    expect(source).toContain("export function ScreenLayout");
  });

  test("exports platform-aware TAB_BAR_CLEARANCE (0 on iOS, 96 on Android)", () => {
    expect(source).toContain('Platform.OS === "ios" ? 0 : 96');
  });

  test("exports HEADER_HEIGHT constant equal to 48", () => {
    expect(source).toContain("HEADER_HEIGHT = 48");
  });

  test("accepts title string prop", () => {
    expect(source).toContain("title: string");
  });

  test('accepts variant prop with "tab" | "sub" types', () => {
    expect(source).toMatch(/variant\??\s*:\s*"tab"\s*\|\s*"sub"/);
  });

  test("accepts rightActions ReactNode prop", () => {
    expect(source).toContain("rightActions");
    expect(source).toContain("ReactNode");
  });

  test("accepts onBack function prop", () => {
    expect(source).toMatch(/onBack\??\s*:\s*\(\)\s*=>\s*void/);
  });

  test("accepts children ReactNode prop", () => {
    expect(source).toContain("children: ReactNode");
  });

  test("tab variant uses font-poppins-extrabold and text-logo classes", () => {
    expect(source).toContain("font-poppins-extrabold");
    expect(source).toContain("text-logo");
  });

  test("sub variant uses font-poppins-bold and text-title classes", () => {
    expect(source).toContain("font-poppins-bold");
    expect(source).toContain("text-title");
  });

  test("sub variant renders ChevronLeft for back button", () => {
    expect(source).toContain("ChevronLeft");
  });

  test("uses useSafeAreaInsets for safe area handling", () => {
    expect(source).toContain("useSafeAreaInsets");
  });

  test("uses Platform for platform-specific rendering", () => {
    expect(source).toContain("Platform");
  });

  test("supports both light and dark mode", () => {
    expect(source).toContain("bg-page");
    expect(source).toContain("dark:bg-page-dark");
  });

  test("header uses px-4 for horizontal padding", () => {
    expect(source).toContain("px-4");
  });

  test("header height is h-12 (48px)", () => {
    expect(source).toContain("h-12");
  });
});
