// biome-ignore-all lint/style/useNamingConvention: mocked React Native module preserves API names
import { beforeEach, describe, expect, test, vi } from "vitest";

const setFocused = vi.fn();
const addEventListener = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  focusManager: {
    setFocused,
  },
}));

vi.mock("@/shared/components/rn", () => ({
  AppState: {
    addEventListener,
  },
}));

describe("installQueryFocusSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("syncs Query focus with active app state and cleans up the listener", async () => {
    const remove = vi.fn();
    addEventListener.mockReturnValue({ remove });

    const { installQueryFocusSubscription } = await import("@/shared/query/focus");

    const cleanup = installQueryFocusSubscription();

    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    const onChange = addEventListener.mock.calls[0]?.[1] as ((status: string) => void) | undefined;
    onChange?.("active");
    onChange?.("background");

    expect(setFocused).toHaveBeenNthCalledWith(1, true);
    expect(setFocused).toHaveBeenNthCalledWith(2, false);

    cleanup();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
