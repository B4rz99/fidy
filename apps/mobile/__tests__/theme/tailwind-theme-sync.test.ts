import { describe, expect, test } from "vitest";
import { Colors } from "@/shared/constants/theme";
import tailwindConfig from "../../tailwind.config";

const twColors = tailwindConfig.theme?.extend?.colors as Record<string, string>;

describe("tailwind <-> Colors sync", () => {
  test("accent-green matches Colors.light.accentGreen", () => {
    expect(twColors["accent-green"]).toBe(Colors.light.accentGreen);
  });

  test("accent-green-dark matches Colors.dark.accentGreen", () => {
    expect(twColors["accent-green-dark"]).toBe(Colors.dark.accentGreen);
  });

  test("page matches Colors.light.page", () => {
    expect(twColors.page).toBe(Colors.light.page);
  });

  test("page-dark matches Colors.dark.page", () => {
    expect(twColors["page-dark"]).toBe(Colors.dark.page);
  });

  test("nav matches Colors.light.nav", () => {
    expect(twColors.nav).toBe(Colors.light.nav);
  });

  test("nav-dark matches Colors.dark.nav", () => {
    expect(twColors["nav-dark"]).toBe(Colors.dark.nav);
  });

  test("chart-food matches Colors.chart.food", () => {
    expect(twColors["chart-food"]).toBe(Colors.chart.food);
  });

  test("chart-transport matches Colors.chart.transport", () => {
    expect(twColors["chart-transport"]).toBe(Colors.chart.transport);
  });

  test("chart-shopping matches Colors.chart.shopping", () => {
    expect(twColors["chart-shopping"]).toBe(Colors.chart.shopping);
  });

  test("chart-bills matches Colors.chart.bills", () => {
    expect(twColors["chart-bills"]).toBe(Colors.chart.bills);
  });

  test("chart-other matches Colors.chart.other", () => {
    expect(twColors["chart-other"]).toBe(Colors.chart.other);
  });
});
