import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn().mockResolvedValue({ isConnected: true });
const mockAddEventListener = vi.fn((_cb: unknown) => vi.fn());

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: () => mockFetch(),
    addEventListener: (cb: unknown) => mockAddEventListener(cb),
  },
}));

describe("networkMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isOnline returns true when connected", async () => {
    mockFetch.mockResolvedValueOnce({ isConnected: true });

    const { isOnline } = await import("@/features/sync/services/networkMonitor");
    const result = await isOnline();

    expect(result).toBe(true);
  });

  it("isOnline returns false when disconnected", async () => {
    mockFetch.mockResolvedValueOnce({ isConnected: false });

    const { isOnline } = await import("@/features/sync/services/networkMonitor");
    const result = await isOnline();

    expect(result).toBe(false);
  });

  it("isOnline returns false when isConnected is null", async () => {
    mockFetch.mockResolvedValueOnce({ isConnected: null });

    const { isOnline } = await import("@/features/sync/services/networkMonitor");
    const result = await isOnline();

    expect(result).toBe(false);
  });

  it("onConnectivityChange subscribes and returns unsubscribe", async () => {
    const callback = vi.fn();
    const mockUnsubscribe = vi.fn();
    mockAddEventListener.mockReturnValueOnce(mockUnsubscribe);

    const { onConnectivityChange } = await import("@/features/sync/services/networkMonitor");
    const unsubscribe = onConnectivityChange(callback);

    expect(mockAddEventListener).toHaveBeenCalled();
    expect(unsubscribe).toBe(mockUnsubscribe);
  });
});
