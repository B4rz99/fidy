import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { expectRouteInRootStackGroup } from "@/__tests__/helpers/root-stack-routes";

describe("Root layout headers", () => {
  let source = "";
  let routeOptionsSource = "";
  let rootStackRoutesSource = "";

  beforeAll(() => {
    source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
    routeOptionsSource = readFileSync(
      resolve(__dirname, "../../shared/components/route-options.ts"),
      "utf-8"
    );
    rootStackRoutesSource = readFileSync(
      resolve(__dirname, "../../shared/navigation/root-stack-routes.ts"),
      "utf-8"
    );
  });

  test("default screenOptions hides headers", () => {
    expect(source).toContain("screenOptions={{ headerShown: false }}");
  });

  test("detail screens use hidden route headers with app-owned solid chrome", () => {
    for (const screen of ["search", "connected-accounts", "profile"]) {
      expectRouteInRootStackGroup(rootStackRoutesSource, "transparentHeader", screen);
    }
    expect(source).toContain("ROOT_STACK_ROUTES.transparentHeader.map");
    expect(source).toContain("routeOptions.transparentHeader");
    expect(routeOptionsSource).toContain("headerShown: false");
    expect(routeOptionsSource).not.toContain("headerTransparent");
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

  test("promoted full-screen routes keep native headers hidden on every platform", () => {
    expect(rootStackRoutesSource).toContain("createFullScreenRouteOptions(theme)");
    expect(routeOptionsSource).toContain("headerShown: false");
    expect(routeOptionsSource).toContain("headerStyle: { backgroundColor: theme.page }");
    expectRouteInRootStackGroup(rootStackRoutesSource, "fullScreen", "add-bill");
    expectRouteInRootStackGroup(rootStackRoutesSource, "fullScreen", "day-detail");
    expect(source).toContain("ROOT_STACK_ROUTES.fullScreen.map");
    expect(source).toContain("routeOptions.fullScreen");
  });

  test("route options do not configure native back affordances", () => {
    expect(routeOptionsSource).not.toContain("customBackHeaderOptions");
    expect(routeOptionsSource).not.toContain("headerBackVisible");
    expect(routeOptionsSource).not.toContain("headerBackButtonDisplayMode");
    expect(routeOptionsSource).not.toContain("headerBackTitle");
    expect(routeOptionsSource).not.toContain("headerLeft");
  });

  test("ScreenLayout full-screen routes use hidden route headers", () => {
    expect(rootStackRoutesSource).toContain("createScreenLayoutRouteOptions(theme)");
    expect(routeOptionsSource).toContain("createScreenLayoutRouteOptions");
    expect(routeOptionsSource).toContain("headerShown: false");

    for (const screen of [
      "financial-account-identifier",
      "link-suggested-account",
      "reclassify-transaction",
    ]) {
      expectRouteInRootStackGroup(rootStackRoutesSource, "screenLayout", screen);
    }
    expect(source).toContain("ROOT_STACK_ROUTES.screenLayout.map");
    expect(source).toContain("routeOptions.screenLayout");
  });
});
