import { describe, expect, test } from "vitest";
import { Colors } from "@/shared/constants/theme";
import { HEX_REGEX } from "../helpers/regex";

describe("Colors", () => {
  test("light and dark have identical keys", () => {
    const lightKeys = Object.keys(Colors.light).sort();
    const darkKeys = Object.keys(Colors.dark).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  test("all light values are valid hex", () => {
    for (const value of Object.values(Colors.light)) {
      expect(value).toMatch(HEX_REGEX);
    }
  });

  test("all dark values are valid hex", () => {
    for (const value of Object.values(Colors.dark)) {
      expect(value).toMatch(HEX_REGEX);
    }
  });

  test("chart has exactly the expected keys", () => {
    const chartKeys = Object.keys(Colors.chart).sort();
    expect(chartKeys).toEqual([
      "clothing",
      "education",
      "entertainment",
      "food",
      "health",
      "home",
      "other",
      "services",
      "transfer",
      "transport",
    ]);
  });

  test("all chart values are valid hex", () => {
    for (const value of Object.values(Colors.chart)) {
      expect(value).toMatch(HEX_REGEX);
    }
  });

  test("accentGreen light is #7CB243", () => {
    expect(Colors.light.accentGreen).toBe("#7CB243");
  });

  test("accentGreen dark is #8BC34A", () => {
    expect(Colors.dark.accentGreen).toBe("#8BC34A");
  });

  test("chart clothing stays visible over dark surfaces", () => {
    expect(Colors.chart.clothing).toBe("#6D6D6D");
    expect(Colors.chart.clothing).not.toBe(Colors.dark.card);
    expect(Colors.chart.clothing).not.toBe(Colors.dark.nav);
  });

  test("neutral text tokens use maximum contrast over aurora backgrounds", () => {
    expect(Colors.light.primary).toBe("#000000");
    expect(Colors.light.textPrimary).toBe("#000000");
    expect(Colors.light.secondary).toBe("#000000");
    expect(Colors.light.textSecondary).toBe("#000000");
    expect(Colors.light.tertiary).toBe("#000000");
    expect(Colors.light.textTertiary).toBe("#000000");
    expect(Colors.dark.primary).toBe("#FFFFFF");
    expect(Colors.dark.textPrimary).toBe("#FFFFFF");
    expect(Colors.dark.secondary).toBe("#FFFFFF");
    expect(Colors.dark.textSecondary).toBe("#FFFFFF");
    expect(Colors.dark.tertiary).toBe("#FFFFFF");
    expect(Colors.dark.textTertiary).toBe("#FFFFFF");
  });

  test("semantic aliases preserve the existing compatibility colors", () => {
    expect(Colors.light.background).toBe(Colors.light.page);
    expect(Colors.dark.background).toBe(Colors.dark.page);
    expect(Colors.light.surface).toBe(Colors.light.card);
    expect(Colors.dark.surface).toBe(Colors.dark.card);
    expect(Colors.light.textPrimary).toBe(Colors.light.primary);
    expect(Colors.dark.textPrimary).toBe(Colors.dark.primary);
    expect(Colors.light.actionPrimary).toBe(Colors.light.accentGreen);
    expect(Colors.dark.actionPrimary).toBe(Colors.dark.accentGreen);
    expect(Colors.light.danger).toBe(Colors.light.accentRed);
    expect(Colors.dark.danger).toBe(Colors.dark.accentRed);
  });
});
