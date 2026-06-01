import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Root layout native headers", () => {
  const source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
  const routeOptionsSource = readFileSync(
    resolve(__dirname, "../../shared/components/route-options.ts"),
    "utf-8"
  );
  const rootStackRoutesSource = readFileSync(
    resolve(__dirname, "../../shared/navigation/root-stack-routes.ts"),
    "utf-8"
  );

  test("default screenOptions hides headers", () => {
    expect(source).toContain("screenOptions={{ headerShown: false }}");
  });

  test("detail screens enable native headers on iOS with aurora-safe chrome", () => {
    for (const screen of ["search", "connected-accounts", "profile"]) {
      expect(rootStackRoutesSource).toContain(`"${screen}"`);
    }
    expect(source).toContain("ROOT_STACK_ROUTES.transparentHeader.map");
    expect(source).toContain("routeOptions.transparentHeader");
    expect(routeOptionsSource).toContain('headerShown: Platform.OS === "ios"');
    expect(routeOptionsSource).toContain('headerStyle: { backgroundColor: "transparent" }');
    expect(routeOptionsSource).toContain("headerTransparent: true");
    expect(rootStackRoutesSource).toContain("createTransparentHeaderRouteOptions(theme)");
  });

  test("dialog modal routes use shared dialog route options without sheet detents", () => {
    expect(rootStackRoutesSource).toContain("dialogRouteOptions");
    expect(routeOptionsSource).toContain('presentation: "transparentModal"');
    expect(routeOptionsSource).toContain('animation: "fade"');
    expect(routeOptionsSource).toContain('contentStyle: { backgroundColor: "transparent" }');
    expect(routeOptionsSource).not.toContain("formSheet");
    expect(routeOptionsSource).not.toContain("sheetAllowedDetents");
  });

  test("promoted full-screen routes keep native headers on every platform", () => {
    expect(rootStackRoutesSource).toContain("createFullScreenRouteOptions(theme)");
    expect(routeOptionsSource).toContain("headerShown: true");
    expect(routeOptionsSource).toContain('headerTransparent: Platform.OS === "ios"');
    expect(routeOptionsSource).toContain(
      'headerStyle: { backgroundColor: Platform.OS === "ios" ? "transparent" : theme.page }'
    );
    expect(rootStackRoutesSource).toContain('"add-bill"');
    expect(rootStackRoutesSource).toContain('"day-detail"');
    expect(source).toContain("ROOT_STACK_ROUTES.fullScreen.map");
    expect(source).toContain("routeOptions.fullScreen");
  });

  test("bills-calendar uses iosHeaderOptions to enable iOS-only native header", () => {
    expect(rootStackRoutesSource).toContain('"bills-calendar"');
    expect(source).toContain("ROOT_STACK_ROUTES.transparentHeader.map");
    expect(source).toContain("routeOptions.transparentHeader");
  });

  test("ScreenLayout full-screen routes avoid Android native header duplication", () => {
    expect(rootStackRoutesSource).toContain("createScreenLayoutRouteOptions(theme)");
    expect(routeOptionsSource).toContain("createScreenLayoutRouteOptions");
    expect(routeOptionsSource).toContain('headerShown: Platform.OS === "ios"');

    for (const screen of [
      "financial-account-identifier",
      "link-suggested-account",
      "reclassify-transaction",
    ]) {
      expect(rootStackRoutesSource).toContain(`"${screen}"`);
    }
    expect(source).toContain("ROOT_STACK_ROUTES.screenLayout.map");
    expect(source).toContain("routeOptions.screenLayout");
  });
});
