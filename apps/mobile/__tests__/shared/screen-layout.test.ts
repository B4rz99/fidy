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

  test("passes rightActions to the native iOS header", () => {
    expect(source).toContain("headerRight: () => rightActions");
  });

  test("does not clear inherited iOS header actions when rightActions is omitted", () => {
    expect(source).toContain("rightActions != null");
    expect(source).toContain("iosHeaderOptions");
  });

  test("does not reserve right action space for sub screens without right actions", () => {
    expect(source).toContain("shouldRenderRightSlot");
    expect(source).toContain('isTab ? "flex-1 flex-row justify-end" : "flex-row justify-end"');
  });

  test("accepts onBack function prop", () => {
    expect(source).toMatch(/onBack\??\s*:\s*\(\)\s*=>\s*void/);
  });

  test("can reserve iOS status-bar space when no native header is present", () => {
    expect(source).toContain("includesNativeHeader?: boolean");
    expect(source).toContain("includesNativeHeader = true");
    expect(source).toContain("shouldRenderCustomHeader");
    expect(source).toContain("!shouldRenderCustomHeader");
  });

  test("renders a custom iOS header for hidden-header sub screens", () => {
    expect(source).toContain("!includesNativeHeader &&");
    expect(source).toContain(
      "!isTab || leftAction != null || rightActions != null || onBack != null"
    );
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
    expect(source).toContain("useColorScheme");
    expect(source).toContain("<AppAuroraBackground");
  });

  test("header uses px-4 for horizontal padding", () => {
    expect(source).toContain("px-4");
  });

  test("header height is h-12 (48px)", () => {
    expect(source).toContain("h-12");
  });
});
