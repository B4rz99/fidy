// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/react-native", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  withScope: vi.fn((cb: (scope: unknown) => void) =>
    cb({ setContext: vi.fn(), setLevel: vi.fn() })
  ),
  ErrorBoundary: "SentryErrorBoundary",
  wrap: vi.fn((component: unknown) => component),
}));

vi.mock("expo-updates", () => ({
  reloadAsync: vi.fn(),
}));

describe("ErrorFallback component", () => {
  it("exports ErrorFallback with restart functionality", () => {
    const source = readFileSync(
      resolve(__dirname, "../../shared/components/ErrorFallback.tsx"),
      "utf-8"
    );

    expect(source).toContain("Something went wrong");
    expect(source).toContain("Restart App");
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
