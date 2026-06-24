// biome-ignore-all lint/suspicious/noExplicitAny: hook dependencies are mocked at module boundaries
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUserId } from "@/shared/types/assertions";

const mockAlert = vi.fn<(...args: any[]) => any>();
const mockBuildSample = vi.fn<(...args: any[]) => any>(() => ({
  template: "[BANK] [AMOUNT] [MERCHANT]",
}));
const mockShareSample = vi.fn<(...args: any[]) => any>(() => Promise.resolve());
const mockSetEmailParseImprovementSharingPreference = vi.fn<(...args: any[]) => any>(() =>
  Promise.resolve()
);
const mockSetupNotificationCapture = vi.fn<(...args: any[]) => any>(() =>
  Promise.resolve(() => undefined)
);
let mockShareAnonymizedParseSamples = false;

const mockPackages = ["com.todo1.mobile.co.bancolombia"];
const mockDb = {} as any;

describe("useNotificationCapture", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockShareAnonymizedParseSamples = false;
    mockSetEmailParseImprovementSharingPreference.mockResolvedValue(undefined);
    mockShareSample.mockResolvedValue(undefined);
  });

  it("does not prompt or share when the global preference is disabled", async () => {
    const { useNotificationCapture } = await loadUseNotificationCapture();
    const userId = requireUserId("user-1");

    useNotificationCapture(mockDb, userId);
    triggerParseImprovementRequest();
    await flushPromises();

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockShareSample).not.toHaveBeenCalled();
    expect(mockSetEmailParseImprovementSharingPreference).not.toHaveBeenCalled();
  });

  it("shares automatically without prompting when the global preference is enabled", async () => {
    mockShareAnonymizedParseSamples = true;
    const { useNotificationCapture } = await loadUseNotificationCapture();
    const userId = requireUserId("user-1");

    useNotificationCapture(mockDb, userId);
    triggerParseImprovementRequest();
    await flushPromises();

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockSetEmailParseImprovementSharingPreference).toHaveBeenCalledWith({
      db: mockDb,
      enabled: true,
      userId,
    });
    expect(mockShareSample).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: true,
        userId,
      })
    );
    expect(
      mockSetEmailParseImprovementSharingPreference.mock.invocationCallOrder[0] ?? 0
    ).toBeLessThan(mockShareSample.mock.invocationCallOrder[0] ?? 0);
  });

  it("does not retain notification samples when the remote opt-in retry fails", async () => {
    mockShareAnonymizedParseSamples = true;
    mockSetEmailParseImprovementSharingPreference.mockRejectedValueOnce(new Error("offline"));
    const { useNotificationCapture } = await loadUseNotificationCapture();
    const userId = requireUserId("user-1");

    useNotificationCapture(mockDb, userId);
    triggerParseImprovementRequest();
    await flushPromises();

    expect(mockSetEmailParseImprovementSharingPreference).toHaveBeenCalledWith({
      db: mockDb,
      enabled: true,
      userId,
    });
    expect(mockShareSample).not.toHaveBeenCalled();
  });
});

async function loadUseNotificationCapture() {
  vi.doMock("@/features/capture-sources/diagnostics.public", () => ({
    buildNotificationParseImprovementSample: (...args: unknown[]) =>
      (mockBuildSample as (...args: unknown[]) => unknown)(...args),
    shareNotificationParseImprovementSample: (...args: unknown[]) =>
      (mockShareSample as (...args: unknown[]) => unknown)(...args),
  }));
  vi.doMock("@/features/settings/hooks.public", () => ({
    useSettingsStore: (selector: any) =>
      selector({ shareAnonymizedParseSamples: mockShareAnonymizedParseSamples }),
  }));
  vi.doMock("@/features/email-capture/parse-improvement.public", () => ({
    setEmailParseImprovementSharingPreference: (...args: unknown[]) =>
      (mockSetEmailParseImprovementSharingPreference as (...args: unknown[]) => unknown)(...args),
  }));
  vi.doMock("@/shared/components/rn", () => ({
    Alert: { alert: (...args: any[]) => mockAlert(...args) },
    Platform: { OS: "android" },
  }));
  vi.doMock("@/shared/hooks", () => ({
    useSubscription: (subscribe: () => void, _deps: readonly unknown[], enabled: boolean) => {
      if (enabled) subscribe();
    },
    useTranslation: () => ({ t: (key: string) => key }),
  }));
  vi.doMock("@/shared/lib", () => ({ captureError: vi.fn<(...args: any[]) => any>() }));
  vi.doMock("@/features/capture-sources/hooks/setup", () => ({
    setupNotificationCapture: (...args: unknown[]) =>
      (mockSetupNotificationCapture as (...args: unknown[]) => unknown)(...args),
  }));
  vi.doMock("@/features/capture-sources/store", () => ({
    useCaptureSourcesStore: (selector: any) => selector({ enabledPackages: mockPackages }),
  }));

  return import("@/features/capture-sources/hooks/useNotificationCapture");
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function triggerParseImprovementRequest() {
  const calls = mockSetupNotificationCapture.mock.calls as unknown as Array<
    [unknown, unknown, unknown, { onParseImprovementRequest: (input: unknown) => void }]
  >;
  const options = calls.at(-1)?.[3];
  if (!options) {
    throw new Error("Notification capture was not configured with parse-improvement options");
  }
  expect(options.onParseImprovementRequest).toEqual(expect.any(Function));
  options.onParseImprovementRequest({
    rawText: "Compra por $50.000 en EXITO",
    source: "notification_android",
    status: "failed",
    confidence: null,
    parseMethod: "llm",
  });
}
