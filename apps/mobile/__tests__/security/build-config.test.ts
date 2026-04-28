import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_APP_ENV = process.env.APP_ENV;
const ORIGINAL_EXPO_PUBLIC_APP_ENV = process.env.EXPO_PUBLIC_APP_ENV;
const ORIGINAL_ENABLE_LOCAL_QA = process.env.EXPO_PUBLIC_ENABLE_LOCAL_QA;

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

afterEach(() => {
  restoreEnv("APP_ENV", ORIGINAL_APP_ENV);
  restoreEnv("EXPO_PUBLIC_APP_ENV", ORIGINAL_EXPO_PUBLIC_APP_ENV);
  restoreEnv("EXPO_PUBLIC_ENABLE_LOCAL_QA", ORIGINAL_ENABLE_LOCAL_QA);
  vi.resetModules();
});

describe("production build security config", () => {
  it("does not include the Expo dev client plugin in production app config", async () => {
    process.env.APP_ENV = "production";
    vi.resetModules();

    const { default: config } = await import("../../app.config");
    const pluginNames = config.plugins?.map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin
    );

    expect(pluginNames).not.toContain("expo-dev-client");
  });

  it("ignores the public local QA flag in production builds", async () => {
    process.env.EXPO_PUBLIC_APP_ENV = "production";
    process.env.EXPO_PUBLIC_ENABLE_LOCAL_QA = "1";
    vi.resetModules();

    const { isLocalQaAvailable } = await import("@/features/qa/local-session");

    expect(isLocalQaAvailable()).toBe(false);
  });
});
