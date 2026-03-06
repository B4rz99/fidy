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
});
