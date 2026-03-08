import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAddListener, mockIsAvailable } = vi.hoisted(() => ({
  mockAddListener: vi.fn(() => ({ remove: vi.fn() })),
  mockIsAvailable: vi.fn(() => true),
}));

vi.mock("expo", () => ({
  requireNativeModule: () => ({
    isAvailable: mockIsAvailable,
    addListener: mockAddListener,
  }),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import {
  addDetectBankSmsListener,
  addLogTransactionListener,
  isAvailable,
} from "@/modules/expo-app-intents";

describe("expo-app-intents JS API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAvailable.mockReturnValue(true);
  });

  describe("isAvailable", () => {
    it("returns true on iOS when native module reports available", () => {
      expect(isAvailable()).toBe(true);
      expect(mockIsAvailable).toHaveBeenCalled();
    });

    it("returns false when native module throws", () => {
      mockIsAvailable.mockImplementation(() => {
        throw new Error("not linked");
      });
      expect(isAvailable()).toBe(false);
    });
  });

  describe("addLogTransactionListener", () => {
    it("subscribes to onLogTransaction event", () => {
      const listener = vi.fn();
      const subscription = addLogTransactionListener(listener);

      expect(mockAddListener).toHaveBeenCalledWith("onLogTransaction", listener);
      expect(subscription).toHaveProperty("remove");
    });

    it("returns a removable subscription", () => {
      const mockRemove = vi.fn();
      mockAddListener.mockReturnValueOnce({ remove: mockRemove });

      const subscription = addLogTransactionListener(vi.fn());
      subscription.remove();

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe("addDetectBankSmsListener", () => {
    it("subscribes to onDetectBankSms event", () => {
      const listener = vi.fn();
      const subscription = addDetectBankSmsListener(listener);

      expect(mockAddListener).toHaveBeenCalledWith("onDetectBankSms", listener);
      expect(subscription).toHaveProperty("remove");
    });
  });
});

describe("expo-app-intents on Android", () => {
  it("isAvailable returns false on non-iOS platform", async () => {
    vi.resetModules();

    vi.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    vi.doMock("expo", () => ({
      requireNativeModule: () => ({
        isAvailable: () => true,
        addListener: vi.fn(),
      }),
    }));

    const mod = await import("@/modules/expo-app-intents/src/index");
    expect(mod.isAvailable()).toBe(false);
  });
});
