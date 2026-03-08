// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAddLogTransactionListener = vi.fn().mockReturnValue({ remove: vi.fn() });
const mockAddDetectBankSmsListener = vi.fn().mockReturnValue({ remove: vi.fn() });
const mockIsAvailable = vi.fn().mockReturnValue(true);
const mockProcessApplePayIntent = vi.fn().mockResolvedValue({ saved: true });
const mockProcessNotification = vi.fn().mockResolvedValue({ saved: true });
const mockInsertDetectedSmsEvent = vi.fn().mockResolvedValue(undefined);
const mockRefreshDetectedSms = vi.fn();
const mockAndroidAddListener = vi.fn().mockReturnValue({ remove: vi.fn() });
const mockAndroidSetAllowedPackages = vi.fn();

vi.mock("@/modules/expo-app-intents", () => ({
  isAvailable: () => mockIsAvailable(),
  addLogTransactionListener: (...args: any[]) => mockAddLogTransactionListener(...args),
  addDetectBankSmsListener: (...args: any[]) => mockAddDetectBankSmsListener(...args),
}));

vi.mock("@/features/capture-sources/services/apple-pay-pipeline", () => ({
  processApplePayIntent: (...args: any[]) => mockProcessApplePayIntent(...args),
}));

vi.mock("@/features/capture-sources/services/notification-pipeline", () => ({
  processNotification: (...args: any[]) => mockProcessNotification(...args),
}));

vi.mock("expo-android-notification-listener-service", () => ({
  addListener: (...args: any[]) => mockAndroidAddListener(...args),
  setAllowedPackages: (...args: any[]) => mockAndroidSetAllowedPackages(...args),
}));

vi.mock("@/features/capture-sources/lib/repository", () => ({
  insertDetectedSmsEvent: (...args: any[]) => mockInsertDetectedSmsEvent(...args),
}));

vi.mock("@/shared/lib/generate-id", () => ({
  generateId: (prefix: string) => `${prefix}-1`,
}));

import {
  setupApplePayCapture,
  setupNotificationCapture,
  setupSmsDetection,
} from "@/features/capture-sources/hooks/setup";

const mockDb = {} as any;
const USER_ID = "user-1";

describe("setupApplePayCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAvailable.mockReturnValue(true);
  });

  it("registers listener and returns cleanup function", async () => {
    const mockRemove = vi.fn();
    mockAddLogTransactionListener.mockReturnValueOnce({ remove: mockRemove });

    const cleanup = await setupApplePayCapture(mockDb, USER_ID);

    expect(mockAddLogTransactionListener).toHaveBeenCalledTimes(1);
    expect(typeof cleanup).toBe("function");

    cleanup();
    expect(mockRemove).toHaveBeenCalled();
  });

  it("returns no-op when module is not available", async () => {
    mockIsAvailable.mockReturnValue(false);

    const cleanup = await setupApplePayCapture(mockDb, USER_ID);

    expect(mockAddLogTransactionListener).not.toHaveBeenCalled();
    cleanup(); // should not throw
  });

  it("calls processApplePayIntent when listener fires", async () => {
    let capturedListener: (event: any) => void = () => {};
    mockAddLogTransactionListener.mockImplementationOnce((listener: any) => {
      capturedListener = listener;
      return { remove: vi.fn() };
    });

    await setupApplePayCapture(mockDb, USER_ID);
    capturedListener({ amount: 50000, merchant: "Farmatodo" });

    expect(mockProcessApplePayIntent).toHaveBeenCalledWith(mockDb, USER_ID, {
      amount: 50000,
      merchant: "Farmatodo",
    });
  });
});

describe("setupSmsDetection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAvailable.mockReturnValue(true);
  });

  it("registers listener and returns cleanup function", async () => {
    const mockRemove = vi.fn();
    mockAddDetectBankSmsListener.mockReturnValueOnce({ remove: mockRemove });

    const cleanup = await setupSmsDetection(mockDb, USER_ID, mockRefreshDetectedSms);

    expect(mockAddDetectBankSmsListener).toHaveBeenCalledTimes(1);

    cleanup();
    expect(mockRemove).toHaveBeenCalled();
  });

  it("inserts SMS event when listener fires", async () => {
    let capturedListener: (event: any) => void = () => {};
    mockAddDetectBankSmsListener.mockImplementationOnce((listener: any) => {
      capturedListener = listener;
      return { remove: vi.fn() };
    });

    await setupSmsDetection(mockDb, USER_ID, mockRefreshDetectedSms);
    capturedListener({ senderName: "Bancolombia", timestamp: "2026-03-07T14:30:00Z" });

    expect(mockInsertDetectedSmsEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        userId: USER_ID,
        senderLabel: "Bancolombia",
        detectedAt: "2026-03-07T14:30:00Z",
      })
    );
  });
});

describe("setupNotificationCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets allowed packages and registers listener", async () => {
    const mockRemove = vi.fn();
    mockAndroidAddListener.mockReturnValueOnce({ remove: mockRemove });
    const packages = ["com.todo1.mobile.co.bancolombia"];

    const cleanup = await setupNotificationCapture(mockDb, USER_ID, packages);

    expect(mockAndroidSetAllowedPackages).toHaveBeenCalledWith(packages);
    expect(mockAndroidAddListener).toHaveBeenCalledWith(
      "onNotificationReceived",
      expect.any(Function)
    );

    cleanup();
    expect(mockRemove).toHaveBeenCalled();
  });

  it("calls processNotification when listener fires", async () => {
    let capturedListener: (event: any) => void = () => {};
    mockAndroidAddListener.mockImplementationOnce((_event: any, listener: any) => {
      capturedListener = listener;
      return { remove: vi.fn() };
    });

    await setupNotificationCapture(mockDb, USER_ID, ["com.todo1.mobile.co.bancolombia"]);

    const notificationData = {
      packageName: "com.todo1.mobile.co.bancolombia",
      text: "Bancolombia le informa compra por $50,000 en EDS LA CASTELLANA.",
      timestamp: Date.now(),
    };
    capturedListener(notificationData);

    expect(mockProcessNotification).toHaveBeenCalledWith(mockDb, USER_ID, notificationData);
  });

  it("returns no-op when no packages provided", async () => {
    const cleanup = await setupNotificationCapture(mockDb, USER_ID, []);

    expect(mockAndroidAddListener).not.toHaveBeenCalled();
    cleanup(); // should not throw
  });
});
