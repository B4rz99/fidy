// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/react-native", () => ({
  init: vi.fn<(...args: any[]) => any>(),
  captureException: vi.fn<(...args: any[]) => any>(),
  captureMessage: vi.fn<(...args: any[]) => any>(),
  setUser: vi.fn<(...args: any[]) => any>(),
  withScope: vi.fn<(...args: any[]) => any>((cb: (scope: unknown) => void) =>
    cb({
      setContext: vi.fn<(...args: any[]) => any>(),
      setLevel: vi.fn<(...args: any[]) => any>(),
    })
  ),
  ErrorBoundary: "SentryErrorBoundary",
  wrap: vi.fn<(...args: any[]) => any>((component: unknown) => component),
}));

vi.mock("expo-updates", () => ({
  reloadAsync: vi.fn<(...args: any[]) => any>(),
}));

describe("ErrorFallback component", () => {
  it("exports ErrorFallback with restart functionality", () => {
    const source = readFileSync(
      resolve(__dirname, "../../shared/components/ErrorFallback.tsx"),
      "utf-8"
    );

    expect(source).toContain('t("errorFallback.title")');
    expect(source).toContain('t("errorFallback.restart")');
    expect(source).toContain("reloadAsync");
  });

  it("SentryErrorBoundary is re-exported from sentry wrapper", () => {
    const source = readFileSync(resolve(__dirname, "../../shared/lib/sentry.ts"), "utf-8");

    expect(source).toContain("SentryErrorBoundary");
    expect(source).toContain("ErrorBoundary");
  });

  it("root layout wraps content with SentryErrorBoundary", () => {
    const source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");

    expect(source).toContain("SentryErrorBoundary");
    expect(source).toContain("ErrorFallback");
  });
});
