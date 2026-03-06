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

  test("chart-entertainment matches Colors.chart.entertainment", () => {
    expect(twColors["chart-entertainment"]).toBe(Colors.chart.entertainment);
  });

  test("chart-health matches Colors.chart.health", () => {
    expect(twColors["chart-health"]).toBe(Colors.chart.health);
  });

  test("chart-education matches Colors.chart.education", () => {
    expect(twColors["chart-education"]).toBe(Colors.chart.education);
  });

  test("chart-home matches Colors.chart.home", () => {
    expect(twColors["chart-home"]).toBe(Colors.chart.home);
  });

  test("chart-clothing matches Colors.chart.clothing", () => {
    expect(twColors["chart-clothing"]).toBe(Colors.chart.clothing);
  });

  test("chart-services matches Colors.chart.services", () => {
    expect(twColors["chart-services"]).toBe(Colors.chart.services);
  });

  test("chart-transfer matches Colors.chart.transfer", () => {
    expect(twColors["chart-transfer"]).toBe(Colors.chart.transfer);
  });

  test("chart-other matches Colors.chart.other", () => {
    expect(twColors["chart-other"]).toBe(Colors.chart.other);
  });
});
