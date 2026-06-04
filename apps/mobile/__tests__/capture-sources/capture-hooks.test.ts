// biome-ignore-all lint/suspicious/noExplicitAny: hook boundary mocks use flexible callbacks
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/shared/types/branded";

const mockUseSubscription = vi.fn<(...args: any[]) => any>();
const mockSetupApplePayCapture = vi.fn<(...args: any[]) => any>(() => "apple-cleanup");
const mockSetupSmsDetection = vi.fn<(...args: any[]) => any>(() => Promise.resolve("sms-cleanup"));
const mockCreateCaptureIngestionPort = vi.fn<(...args: any[]) => any>(() => ({
  ingest: mockIngest,
}));
const mockIngest = vi.fn<(...args: any[]) => any>(() => Promise.resolve());
const mockAppStateAddEventListener = vi.fn<(...args: any[]) => any>(() => ({ remove: vi.fn() }));
const platform = { OS: "ios" };

vi.mock("@/shared/hooks", () => ({
  useSubscription: (...args: any[]) => mockUseSubscription(...args),
}));

vi.mock("@/shared/components/rn", () => ({
  AppState: { addEventListener: (...args: any[]) => mockAppStateAddEventListener(...args) },
  Platform: platform,
}));

vi.mock("@/features/capture-sources/hooks/setup", () => ({
  setupApplePayCapture: (...args: any[]) => mockSetupApplePayCapture(...args),
  setupSmsDetection: (...args: any[]) => mockSetupSmsDetection(...args),
}));

vi.mock("@/features/capture-sources/services/capture-ingestion", () => ({
  createCaptureIngestionPort: (...args: any[]) => mockCreateCaptureIngestionPort(...args),
}));

vi.mock("@/features/capture-sources/services/widget-pipeline", () => ({
  processWidgetTransactions: vi.fn(),
}));

vi.mock("@/features/capture-sources/store", () => ({
  refreshDetectedSmsCount: vi.fn(),
}));

vi.mock("@/shared/lib", () => ({
  captureError: vi.fn(),
}));

const db = {} as never;
const userId = "user-1" as UserId;

describe("capture hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platform.OS = "ios";
  });

  it("subscribes Apple Pay only when iOS dependencies are ready", async () => {
    const { useApplePayCapture } =
      await import("@/features/capture-sources/hooks/useApplePayCapture");

    useApplePayCapture(db, userId);
    const [subscribe, deps, enabled] = mockUseSubscription.mock.calls[0]!;

    expect(deps).toEqual([db, userId]);
    expect(enabled).toBe(true);
    expect(subscribe()).toBe("apple-cleanup");
    expect(mockSetupApplePayCapture).toHaveBeenCalledWith(db, userId);

    useApplePayCapture(null, userId);
    expect(mockUseSubscription.mock.calls[1]![2]).toBe(false);
  });

  it("subscribes SMS detection and returns nothing without dependencies", async () => {
    const { useSmsDetection } = await import("@/features/capture-sources/hooks/useSmsDetection");

    useSmsDetection(db, userId);
    const [subscribe, _deps, enabled] = mockUseSubscription.mock.calls[0]!;
    expect(enabled).toBe(true);
    await expect(subscribe()).resolves.toBe("sms-cleanup");

    useSmsDetection(null, userId);
    expect(mockUseSubscription.mock.calls[1]![0]()).toBeUndefined();
  });

  it("ingests widget transactions on mount and when the app becomes active", async () => {
    const { useWidgetCapture } = await import("@/features/capture-sources/hooks/useWidgetCapture");

    useWidgetCapture(db, userId);
    const [subscribe, _deps, enabled] = mockUseSubscription.mock.calls[0]!;
    expect(enabled).toBe(true);

    const cleanup = subscribe();
    const appStateListener = mockAppStateAddEventListener.mock.calls[0]![1];
    appStateListener("background");
    appStateListener("active");

    expect(mockIngest).toHaveBeenCalledTimes(2);
    expect(mockIngest).toHaveBeenCalledWith({ kind: "widget", userId });
    cleanup();
  });
});
