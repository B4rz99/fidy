import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("QA network inspector", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("captures successful fetch requests when the network inspector is enabled", async () => {
    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;

    const { useQaDevtoolsStore } = await import("@/features/qa/devtools-store");
    const { installQaFetchInspector } = await import("@/features/qa/network-inspector");

    useQaDevtoolsStore.setState({
      ...useQaDevtoolsStore.getState(),
      flags: {
        networkInspectorEnabled: true,
        logInspectorEnabled: true,
        simulateOffline: false,
        showQaBanner: false,
      },
    });

    const uninstall = installQaFetchInspector();

    await fetch("https://example.com/health", { method: "POST" });

    expect(useQaDevtoolsStore.getState().networkEvents[0]).toMatchObject({
      method: "POST",
      url: "https://example.com/health",
      outcome: "success",
      status: 200,
    });

    uninstall();
  });

  it("blocks requests when simulateOffline is enabled", async () => {
    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as typeof fetch;

    const { useQaDevtoolsStore } = await import("@/features/qa/devtools-store");
    const { installQaFetchInspector } = await import("@/features/qa/network-inspector");

    useQaDevtoolsStore.setState({
      ...useQaDevtoolsStore.getState(),
      flags: {
        networkInspectorEnabled: true,
        logInspectorEnabled: true,
        simulateOffline: true,
        showQaBanner: false,
      },
    });

    const uninstall = installQaFetchInspector();

    await expect(fetch("https://example.com/offline")).rejects.toThrow("simulateOffline");

    expect(useQaDevtoolsStore.getState().networkEvents[0]).toMatchObject({
      method: "GET",
      url: "https://example.com/offline",
      outcome: "blocked",
      status: null,
    });

    uninstall();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });
});
