import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Root layout native headers", () => {
  const source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");

  test("default screenOptions hides headers", () => {
    expect(source).toContain("screenOptions={{ headerShown: false }}");
  });

  test("detail screens enable native headers on iOS with themed colors", () => {
    for (const screen of ["search", "connected-accounts", "failed-emails", "profile"]) {
      // Each detail screen's options block must contain headerShown with Platform.OS check
      const screenBlock = source.slice(source.indexOf(`name="${screen}"`));
      const optionsSlice = screenBlock.slice(0, screenBlock.indexOf("/>") + 2);
      expect(optionsSlice).toContain('headerShown: Platform.OS === "ios"');
      expect(optionsSlice).toContain("theme.page");
    }
  });

  test("formSheet modals use SHEET constant with headerShown: false", () => {
    expect(source).toContain(
      'const SHEET = { headerShown: false, presentation: "formSheet" } as const'
    );
    expect(source).toContain('name="add-bill"');
    // add-bill options must spread SHEET
    const addBillBlock = source.slice(source.indexOf('name="add-bill"'));
    expect(addBillBlock.slice(0, 200)).toContain("...SHEET");
  });
});
