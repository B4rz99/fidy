import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { Colors } from "@/shared/constants/theme";

const css = readFileSync(resolve(__dirname, "../../global.css"), "utf-8");

const parseCssColor = (name: string): string | undefined => {
  const match = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  return match?.[1]?.trim();
};

describe("global.css @theme <-> Colors sync", () => {
  test("accent-green matches Colors.light.accentGreen", () => {
    expect(parseCssColor("accent-green")).toBe(Colors.light.accentGreen);
  });

  test("accent-green-dark matches Colors.dark.accentGreen", () => {
    expect(parseCssColor("accent-green-dark")).toBe(Colors.dark.accentGreen);
  });

  test("page matches Colors.light.page", () => {
    expect(parseCssColor("page")).toBe(Colors.light.page);
  });

  test("page-dark matches Colors.dark.page", () => {
    expect(parseCssColor("page-dark")).toBe(Colors.dark.page);
  });

  test("nav matches Colors.light.nav", () => {
    expect(parseCssColor("nav")).toBe(Colors.light.nav);
  });

  test("nav-dark matches Colors.dark.nav", () => {
    expect(parseCssColor("nav-dark")).toBe(Colors.dark.nav);
  });

  test("chart-food matches Colors.chart.food", () => {
    expect(parseCssColor("chart-food")).toBe(Colors.chart.food);
  });

  test("chart-transport matches Colors.chart.transport", () => {
    expect(parseCssColor("chart-transport")).toBe(Colors.chart.transport);
  });

  test("chart-entertainment matches Colors.chart.entertainment", () => {
    expect(parseCssColor("chart-entertainment")).toBe(Colors.chart.entertainment);
  });

  test("chart-health matches Colors.chart.health", () => {
    expect(parseCssColor("chart-health")).toBe(Colors.chart.health);
  });

  test("chart-education matches Colors.chart.education", () => {
    expect(parseCssColor("chart-education")).toBe(Colors.chart.education);
  });

  test("chart-home matches Colors.chart.home", () => {
    expect(parseCssColor("chart-home")).toBe(Colors.chart.home);
  });

  test("chart-clothing matches Colors.chart.clothing", () => {
    expect(parseCssColor("chart-clothing")).toBe(Colors.chart.clothing);
  });

  test("chart-services matches Colors.chart.services", () => {
    expect(parseCssColor("chart-services")).toBe(Colors.chart.services);
  });

  test("chart-transfer matches Colors.chart.transfer", () => {
    expect(parseCssColor("chart-transfer")).toBe(Colors.chart.transfer);
  });

  test("chart-other matches Colors.chart.other", () => {
    expect(parseCssColor("chart-other")).toBe(Colors.chart.other);
  });
});
