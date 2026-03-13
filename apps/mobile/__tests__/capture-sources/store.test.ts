// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

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
}));

import { useCaptureSourcesStore } from "@/features/capture-sources/store";

const mockDb = {} as any;
const USER_ID = "user-1";

describe("useCaptureSourcesStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCaptureSourcesStore.getState()._resetRefs();
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

  describe("initStore", () => {
    it("sets db and userId refs for subsequent actions", () => {
      useCaptureSourcesStore.getState().initStore(mockDb, USER_ID);
      expect(() => useCaptureSourcesStore.getState().initStore(mockDb, USER_ID)).not.toThrow();
    });
  });

  describe("loadConfig", () => {
    it("loads enabled packages from DB", async () => {
      mockGetEnabledPackages.mockResolvedValueOnce([
        "com.todo1.mobile.co.bancolombia",
        "com.nequi.MobileApp",
      ]);

      useCaptureSourcesStore.getState().initStore(mockDb, USER_ID);
      await useCaptureSourcesStore.getState().loadConfig();

      expect(mockGetEnabledPackages).toHaveBeenCalledWith(mockDb, USER_ID);
      expect(useCaptureSourcesStore.getState().enabledPackages).toEqual([
        "com.todo1.mobile.co.bancolombia",
        "com.nequi.MobileApp",
      ]);
    });

    it("does nothing when db is not set", async () => {
      await useCaptureSourcesStore.getState().loadConfig();

      expect(mockGetEnabledPackages).not.toHaveBeenCalled();
    });
  });

  describe("togglePackage", () => {
    it("enables a package and upserts to DB", async () => {
      useCaptureSourcesStore.getState().initStore(mockDb, USER_ID);
      await useCaptureSourcesStore.getState().togglePackage("com.nequi.MobileApp", true);

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

    it("disables a package and removes from state", async () => {
      useCaptureSourcesStore.getState().initStore(mockDb, USER_ID);
      useCaptureSourcesStore.setState({ enabledPackages: ["com.nequi.MobileApp"] });

      await useCaptureSourcesStore.getState().togglePackage("com.nequi.MobileApp", false);

      expect(mockUpsertNotificationSource).toHaveBeenCalledWith(
        mockDb,
        USER_ID,
        "com.nequi.MobileApp",
        "Nequi",
        false,
        expect.any(String)
      );
      expect(useCaptureSourcesStore.getState().enabledPackages).not.toContain(
        "com.nequi.MobileApp"
      );
    });
  });

  describe("refreshStatus", () => {
    it("sets isApplePaySetupComplete when captures exist", async () => {
      mockHasProcessedCaptures.mockResolvedValueOnce(true);

      useCaptureSourcesStore.getState().initStore(mockDb, USER_ID);
      await useCaptureSourcesStore.getState().refreshStatus();

      expect(mockHasProcessedCaptures).toHaveBeenCalledWith(mockDb, "apple_pay");
      expect(useCaptureSourcesStore.getState().isApplePaySetupComplete).toBe(true);
    });

    it("sets isApplePaySetupComplete false when no captures", async () => {
      mockHasProcessedCaptures.mockResolvedValueOnce(false);

      useCaptureSourcesStore.getState().initStore(mockDb, USER_ID);
      await useCaptureSourcesStore.getState().refreshStatus();

      expect(useCaptureSourcesStore.getState().isApplePaySetupComplete).toBe(false);
    });
  });

  describe("refreshDetectedSms", () => {
    it("updates detectedSmsCount from DB", async () => {
      mockGetTodaySmsEventCount.mockResolvedValueOnce(3);

      useCaptureSourcesStore.getState().initStore(mockDb, USER_ID);
      await useCaptureSourcesStore.getState().refreshDetectedSms();

      expect(mockGetTodaySmsEventCount).toHaveBeenCalledWith(mockDb, USER_ID, expect.any(Date));
      expect(useCaptureSourcesStore.getState().detectedSmsCount).toBe(3);
    });

    it("does nothing when db is not set", async () => {
      await useCaptureSourcesStore.getState().refreshDetectedSms();

      expect(mockGetTodaySmsEventCount).not.toHaveBeenCalled();
    });
  });
});
