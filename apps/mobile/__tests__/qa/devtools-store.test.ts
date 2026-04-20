import { getItem, setItem } from "expo-secure-store";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("QA devtools store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.mocked(getItem).mockReturnValue(null);
  });

  it("loads persisted flags and re-persists updates", async () => {
    vi.mocked(getItem).mockReturnValueOnce(
      JSON.stringify({
        networkInspectorEnabled: false,
        logInspectorEnabled: true,
        simulateOffline: true,
        showQaBanner: true,
      })
    );

    const { useQaDevtoolsStore } = await import("@/features/qa/devtools-store");

    expect(useQaDevtoolsStore.getState().flags).toMatchObject({
      networkInspectorEnabled: false,
      simulateOffline: true,
      showQaBanner: true,
    });

    useQaDevtoolsStore.getState().setFlag("networkInspectorEnabled", true);

    expect(vi.mocked(setItem)).toHaveBeenCalledWith(
      "qa_devtools_flags_v1",
      expect.stringContaining('"networkInspectorEnabled":true')
    );
  });

  it("records bounded QA log and network history", async () => {
    const { useQaDevtoolsStore } = await import("@/features/qa/devtools-store");

    useQaDevtoolsStore.setState({
      ...useQaDevtoolsStore.getState(),
      flags: {
        networkInspectorEnabled: true,
        logInspectorEnabled: true,
        simulateOffline: false,
        showQaBanner: false,
      },
    });

    useQaDevtoolsStore.getState().recordLog({
      level: "info",
      message: "qa_test_log",
      context: { source: "unit" },
    });
    useQaDevtoolsStore.getState().recordNetworkEvent({
      method: "GET",
      url: "https://example.com",
      outcome: "success",
      status: 200,
      durationMs: 14,
      errorMessage: null,
    });

    expect(useQaDevtoolsStore.getState().logs[0]).toMatchObject({
      level: "info",
      message: "qa_test_log",
    });
    expect(useQaDevtoolsStore.getState().networkEvents[0]).toMatchObject({
      method: "GET",
      url: "https://example.com",
      status: 200,
    });
  });
});
