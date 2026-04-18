// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hydrateCaptureSources,
  refreshCaptureSourceStatus,
  refreshDetectedSmsCount,
  toggleCaptureSourcePackage,
  useCaptureSourcesStore,
} from "@/features/capture-sources/store";
import { requireUserId } from "@/shared/types/assertions";

const mockGetEnabledPackages = vi.fn().mockResolvedValue([]);
const mockUpsertNotificationSource = vi.fn();
const mockHasProcessedCaptures = vi.fn().mockResolvedValue(false);
const mockGetTodaySmsEventCount = vi.fn().mockResolvedValue(0);

vi.mock("@/features/capture-sources/lib/repository", () => ({
  getEnabledPackages: (...args: any[]) => mockGetEnabledPackages(...args),
  upsertNotificationSource: (...args: any[]) => mockUpsertNotificationSource(...args),
  hasProcessedCaptures: (...args: any[]) => mockHasProcessedCaptures(...args),
  getTodaySmsEventCount: (...args: any[]) => mockGetTodaySmsEventCount(...args),
}));

vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (prefix: string) => `${prefix}-1`,
  generateNotificationSourceId: () => "ns-1",
}));

const mockDb = {} as any;
const USER_ID = requireUserId("user-1");

describe("useCaptureSourcesStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCaptureSourcesStore.setState({
      enabledPackages: [],
      isNotificationPermissionGranted: false,
      isApplePaySetupComplete: false,
      detectedSmsCount: 0,
    });
    mockGetEnabledPackages.mockResolvedValue([]);
    mockHasProcessedCaptures.mockResolvedValue(false);
    mockGetTodaySmsEventCount.mockResolvedValue(0);
  });

  it("hydrates capture-source state from the explicit boundary", async () => {
    mockGetEnabledPackages.mockResolvedValueOnce([
      "com.todo1.mobile.co.bancolombia",
      "com.nequi.MobileApp",
    ]);
    mockHasProcessedCaptures.mockResolvedValueOnce(true);
    mockGetTodaySmsEventCount.mockResolvedValueOnce(3);

    await hydrateCaptureSources(mockDb, USER_ID);

    expect(mockGetEnabledPackages).toHaveBeenCalledWith(mockDb, USER_ID);
    expect(mockHasProcessedCaptures).toHaveBeenCalledWith(mockDb, "apple_pay");
    expect(mockGetTodaySmsEventCount).toHaveBeenCalledWith(mockDb, USER_ID, expect.any(Date));
    expect(useCaptureSourcesStore.getState()).toMatchObject({
      enabledPackages: ["com.todo1.mobile.co.bancolombia", "com.nequi.MobileApp"],
      isApplePaySetupComplete: true,
      detectedSmsCount: 3,
    });
  });

  it("toggles a package through the explicit boundary and updates store state", async () => {
    await toggleCaptureSourcePackage(mockDb, USER_ID, "com.nequi.MobileApp", true);

    expect(mockUpsertNotificationSource).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      "com.nequi.MobileApp",
      "Nequi",
      true,
      expect.any(String)
    );
    expect(useCaptureSourcesStore.getState().enabledPackages).toContain("com.nequi.MobileApp");
  });

  it("refreshes Apple Pay setup status through the explicit boundary", async () => {
    mockHasProcessedCaptures.mockResolvedValueOnce(true);

    await refreshCaptureSourceStatus(mockDb);

    expect(mockHasProcessedCaptures).toHaveBeenCalledWith(mockDb, "apple_pay");
    expect(useCaptureSourcesStore.getState().isApplePaySetupComplete).toBe(true);
  });

  it("refreshes detected SMS count through the explicit boundary", async () => {
    mockGetTodaySmsEventCount.mockResolvedValueOnce(3);

    await refreshDetectedSmsCount(mockDb, USER_ID);

    expect(mockGetTodaySmsEventCount).toHaveBeenCalledWith(mockDb, USER_ID, expect.any(Date));
    expect(useCaptureSourcesStore.getState().detectedSmsCount).toBe(3);
  });
});
