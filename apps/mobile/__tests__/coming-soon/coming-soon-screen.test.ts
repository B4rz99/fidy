import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("ComingSoonScreen", () => {
  const source = readFileSync(
    resolve(__dirname, "../../shared/components/ComingSoonScreen.tsx"),
    "utf-8"
  );

  test("exports ComingSoonScreen as named export", () => {
    expect(source).toContain("export function ComingSoonScreen");
  });

  test("accepts Icon prop of type LucideIcon", () => {
    expect(source).toContain("Icon: LucideIcon");
  });

  test("accepts headerTitle, headline, and description string props", () => {
    expect(source).toContain("headerTitle: string");
    expect(source).toContain("headline: string");
    expect(source).toContain("description: string");
  });

  test("renders the headerTitle text", () => {
    expect(source).toContain("{headerTitle}");
  });

  test("renders the headline text", () => {
    expect(source).toContain("{headline}");
  });

  test("renders the description text", () => {
    expect(source).toContain("{description}");
  });

  test("renders COMING SOON pill text", () => {
    expect(source).toContain("COMING SOON");
  });

  test("uses Icon prop to render the icon", () => {
    expect(source).toContain("<Icon");
  });

  test("uses useThemeColor for icon color", () => {
    expect(source).toContain('useThemeColor("accentGreen")');
  });

  test("uses safe area insets for top padding", () => {
    expect(source).toContain("useSafeAreaInsets");
  });

  test("uses title font size for headline", () => {
    expect(source).toContain("text-title");
  });

  test("supports dark mode", () => {
    expect(source).toContain("dark:bg-page-dark");
    expect(source).toContain("dark:text-primary-dark");
  });
});
