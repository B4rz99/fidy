import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Root layout native headers", () => {
  const source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");

  test("default screenOptions hides headers", () => {
    expect(source).toContain("screenOptions={{ headerShown: false }}");
  });

  test("detail screens enable native headers on iOS with aurora-safe chrome", () => {
    for (const screen of ["search", "connected-accounts", "profile"]) {
      expect(source).toContain(`"${screen}"`);
      const screenStart = source.indexOf(`name="${screen}"`);
      const screenBlock = source.slice(screenStart, source.indexOf("/>", screenStart));
      expect(screenBlock).not.toContain("headerTransparent");
    }
    expect(source).toContain('headerShown: Platform.OS === "ios"');
    expect(source).toContain('headerStyle: { backgroundColor: "transparent" }');
    expect(source).toContain("headerTransparent: true");
    expect(source).toContain("theme.primary");
  });

  test("dialog modal routes use DIALOG_MODAL without sheet detents", () => {
    expect(source).toContain("const DIALOG_MODAL = {");
    expect(source).toContain('presentation: "transparentModal"');
    expect(source).toContain('animation: "fade"');
    expect(source).toContain('contentStyle: { backgroundColor: "transparent" }');
    expect(source).not.toContain("formSheet");
    expect(source).not.toContain("sheetAllowedDetents");
  });

  test("promoted full-screen routes keep native headers on every platform", () => {
    expect(source).toContain("const fullScreenHeaderOptions = {");
    expect(source).toContain("headerShown: true");
    expect(source).toContain('headerTransparent: Platform.OS === "ios"');
    expect(source).toContain(
      'headerStyle: { backgroundColor: Platform.OS === "ios" ? "transparent" : theme.page }'
    );
    expect(source).toContain('name="add-bill"');
    const addBillStart = source.indexOf('name="add-bill"');
    const dayDetailStart = source.indexOf('name="day-detail"');
    expect(addBillStart).toBeGreaterThan(-1);
    expect(dayDetailStart).toBeGreaterThan(addBillStart);
    const addBillBlock = source.slice(addBillStart, dayDetailStart);
    expect(addBillBlock).toContain("fullScreenHeaderOptions");
    expect(addBillBlock).not.toContain("DIALOG_MODAL");
  });

  test("bills-calendar leaves Android custom ScreenLayout as the only header", () => {
    expect(source).toContain('<Stack.Screen name="bills-calendar" options={iosHeaderOptions} />');
  });
});
