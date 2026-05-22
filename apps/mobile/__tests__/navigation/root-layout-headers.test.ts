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
    }
    expect(source).toContain('headerShown: Platform.OS === "ios"');
    expect(source).toContain('headerStyle: { backgroundColor: "transparent" }');
    expect(source).toContain("theme.primary");
    expect(source).not.toContain("headerTransparent");
  });

  test("dialog modal routes use DIALOG_MODAL without sheet detents", () => {
    expect(source).toContain("const DIALOG_MODAL = {");
    expect(source).toContain('presentation: "transparentModal"');
    expect(source).toContain('animation: "fade"');
    expect(source).toContain('contentStyle: { backgroundColor: "transparent" }');
    expect(source).not.toContain("formSheet");
    expect(source).not.toContain("sheetAllowedDetents");
    expect(source).toContain('name="add-bill"');
    // add-bill options must use the shared dialog modal presentation.
    const addBillBlock = source.slice(source.indexOf('name="add-bill"'));
    expect(addBillBlock.slice(0, 200)).toContain("DIALOG_MODAL");
  });
});
