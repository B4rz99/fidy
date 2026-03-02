// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Colors } from "@/shared/constants/theme";

let currentScheme: "light" | "dark" | null = "light";

vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  useColorScheme: () => currentScheme,
}));

describe("useThemeColor", () => {
  beforeEach(() => {
    currentScheme = "light";
    vi.resetModules();
  });

  test("returns light color for light scheme", async () => {
    currentScheme = "light";
    const { useThemeColor } = await import("@/shared/hooks/use-theme-color");
    expect(useThemeColor("page")).toBe(Colors.light.page);
  });

  test("returns dark color for dark scheme", async () => {
    currentScheme = "dark";
    const { useThemeColor } = await import("@/shared/hooks/use-theme-color");
    expect(useThemeColor("page")).toBe(Colors.dark.page);
  });

  test("falls back to light for null scheme", async () => {
    currentScheme = null;
    const { useThemeColor } = await import("@/shared/hooks/use-theme-color");
    expect(useThemeColor("page")).toBe(Colors.light.page);
  });

  test("returns correct value for multiple keys", async () => {
    currentScheme = "light";
    const { useThemeColor } = await import("@/shared/hooks/use-theme-color");
    expect(useThemeColor("accentGreen")).toBe(Colors.light.accentGreen);
    expect(useThemeColor("nav")).toBe(Colors.light.nav);
  });
});
