import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Root layout native headers", () => {
  const source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
  const routeOptionsSource = readFileSync(
    resolve(__dirname, "../../shared/components/route-options.ts"),
    "utf-8"
  );

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
    expect(routeOptionsSource).toContain('headerShown: Platform.OS === "ios"');
    expect(routeOptionsSource).toContain('headerStyle: { backgroundColor: "transparent" }');
    expect(routeOptionsSource).toContain("headerTransparent: true");
    expect(source).toContain("createTransparentHeaderRouteOptions(theme)");
  });

  test("dialog modal routes use shared dialog route options without sheet detents", () => {
    expect(source).toContain("dialogRouteOptions");
    expect(routeOptionsSource).toContain('presentation: "transparentModal"');
    expect(routeOptionsSource).toContain('animation: "fade"');
    expect(routeOptionsSource).toContain('contentStyle: { backgroundColor: "transparent" }');
    expect(routeOptionsSource).not.toContain("formSheet");
    expect(routeOptionsSource).not.toContain("sheetAllowedDetents");
  });

  test("promoted full-screen routes keep native headers on every platform", () => {
    expect(source).toContain("createFullScreenRouteOptions(theme)");
    expect(routeOptionsSource).toContain("headerShown: true");
    expect(routeOptionsSource).toContain('headerTransparent: Platform.OS === "ios"');
    expect(routeOptionsSource).toContain(
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

  test("bills-calendar uses iosHeaderOptions to enable iOS-only native header", () => {
    expect(source).toContain('<Stack.Screen name="bills-calendar" options={iosHeaderOptions} />');
  });
});
