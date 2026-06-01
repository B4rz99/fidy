import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

describe("Root layout query provider", () => {
  let source = "";
  let rootStackRoutesSource = "";

  beforeAll(() => {
    source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");
    rootStackRoutesSource = readFileSync(
      resolve(__dirname, "../../shared/navigation/root-stack-routes.ts"),
      "utf-8"
    );
  });

  test("wraps the app tree in QueryProvider", () => {
    expect(source).toContain('import { QueryProvider } from "@/shared/query"');
    expect(source).toContain("<QueryProvider>");
    expect(source).toContain("</QueryProvider>");
  });

  test("keeps SentryErrorBoundary outside QueryProvider", () => {
    const sentryIndex = source.indexOf("<SentryErrorBoundary fallback={ErrorFallback}>");
    const queryIndex = source.indexOf("<QueryProvider>");

    expect(sentryIndex).toBeGreaterThan(-1);
    expect(queryIndex).toBeGreaterThan(-1);
    expect(sentryIndex).toBeLessThan(queryIndex);
  });

  test("keeps the existing root Stack screen declarations", () => {
    for (const screen of ["(auth)", "(tabs)"]) {
      expect(source).toContain(`"${screen}"`);
    }

    for (const screen of ["add-bill", "delete-account", "analytics"]) {
      expect(rootStackRoutesSource).toContain(`"${screen}"`);
    }
  });

  test("declares status bar system UI", () => {
    expect(source).toContain('<StatusBar style="auto" />');
  });

  test("hydrates settings before showing the first app frame", () => {
    expect(source).toContain("useSettingsStore.getState().hydrate()");
    expect(source).toContain("settingsHydrated");
    expect(source).toContain("isAuthLoading || !settingsHydrated");
  });
});
