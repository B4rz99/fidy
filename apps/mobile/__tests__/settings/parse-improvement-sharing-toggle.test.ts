import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyParseImprovementSharingToggle } from "@/features/settings/components/parse-improvement-sharing-toggle";
import type { UserId } from "@/shared/types/branded";

const {
  mockCaptureError,
  mockCaptureWarning,
  mockCountPendingEmailParseImprovementSamples,
  mockFlushPendingEmailParseImprovementSamples,
  mockGetDb,
  mockIsEmailCaptureDebugEnabled,
  mockSettingsState,
} = vi.hoisted(() => ({
  mockCaptureError: vi.fn<(error: unknown) => void>(),
  mockCaptureWarning: vi.fn<(message: string, context?: unknown) => void>(),
  mockCountPendingEmailParseImprovementSamples: vi.fn<(...args: unknown[]) => number>(() => 1),
  mockFlushPendingEmailParseImprovementSamples: vi.fn<(...args: unknown[]) => Promise<unknown>>(
    () => Promise.resolve({ shared: 0, failed: 0 })
  ),
  mockGetDb: vi.fn<(...args: unknown[]) => unknown>(() => ({})),
  mockIsEmailCaptureDebugEnabled: vi.fn<() => boolean>(() => false),
  mockSettingsState: { shareAnonymizedParseSamples: true },
}));

vi.mock("@/features/email-capture/parse-improvement.public", () => ({
  countPendingEmailParseImprovementSamples: (...args: unknown[]) =>
    mockCountPendingEmailParseImprovementSamples(...args),
  flushPendingEmailParseImprovementSamples: (...args: unknown[]) =>
    mockFlushPendingEmailParseImprovementSamples(...args),
  isEmailCaptureDebugEnabled: () => mockIsEmailCaptureDebugEnabled(),
}));

vi.mock("@/shared/db", () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

vi.mock("@/shared/lib", () => ({
  captureError: (error: unknown) => mockCaptureError(error),
  captureWarning: (message: string, context?: unknown) => mockCaptureWarning(message, context),
}));

vi.mock("@/features/settings/store", () => ({
  useSettingsStore: {
    getState: () => mockSettingsState,
  },
}));

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("applyParseImprovementSharingToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEmailCaptureDebugEnabled.mockReturnValue(false);
    mockSettingsState.shareAnonymizedParseSamples = true;
  });

  it("only counts pending samples for debug logging", async () => {
    applyParseImprovementSharingToggle({
      enabled: false,
      userId: "user-1" as UserId,
      setShareAnonymizedParseSamples: vi.fn(),
    });

    expect(mockCountPendingEmailParseImprovementSamples).not.toHaveBeenCalled();

    mockIsEmailCaptureDebugEnabled.mockReturnValue(true);
    applyParseImprovementSharingToggle({
      enabled: false,
      userId: "user-1" as UserId,
      setShareAnonymizedParseSamples: vi.fn(),
    });

    expect(mockCountPendingEmailParseImprovementSamples).toHaveBeenCalledTimes(1);
  });

  it("captures flush failures returned from toggle-triggered sharing", async () => {
    mockFlushPendingEmailParseImprovementSamples.mockResolvedValueOnce({
      shared: 0,
      failed: 2,
      failureTypes: ["ParseImprovementSampleInsertError"],
    });

    applyParseImprovementSharingToggle({
      enabled: true,
      userId: "user-1" as UserId,
      setShareAnonymizedParseSamples: vi.fn(),
    });
    await flushPromises();

    expect(mockCaptureWarning).toHaveBeenCalledWith("email_parse_improvement_sample_share_failed", {
      errorType: "ParseImprovementSampleInsertError",
    });
  });

  it("captures empty flush failure types as unknown", async () => {
    mockFlushPendingEmailParseImprovementSamples.mockResolvedValueOnce({
      shared: 0,
      failed: 1,
      failureTypes: [],
    });

    applyParseImprovementSharingToggle({
      enabled: true,
      userId: "user-1" as UserId,
      setShareAnonymizedParseSamples: vi.fn(),
    });
    await flushPromises();

    expect(mockCaptureWarning).toHaveBeenCalledWith("email_parse_improvement_sample_share_failed", {
      errorType: "unknown",
    });
  });

  it("captures rejected toggle-triggered flushes as share warnings", async () => {
    const error = new Error("flush failed");
    mockFlushPendingEmailParseImprovementSamples.mockRejectedValueOnce(error);

    applyParseImprovementSharingToggle({
      enabled: true,
      userId: "user-1" as UserId,
      setShareAnonymizedParseSamples: vi.fn(),
    });
    await flushPromises();

    expect(mockCaptureError).toHaveBeenCalledWith(error);
    expect(mockCaptureWarning).toHaveBeenCalledWith("email_parse_improvement_sample_share_failed", {
      errorType: "Error",
    });
  });

  it("queues a re-enabled flush behind an in-flight toggle flush", async () => {
    let resolveFirstFlush: () => void = () => undefined;
    mockFlushPendingEmailParseImprovementSamples
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstFlush = () => resolve({ shared: 0, failed: 0 });
        })
      )
      .mockResolvedValueOnce({ shared: 1, failed: 0 });
    const setShareAnonymizedParseSamples = vi.fn((enabled: boolean) => {
      mockSettingsState.shareAnonymizedParseSamples = enabled;
    });
    const userId = "user-1" as UserId;

    applyParseImprovementSharingToggle({ enabled: true, userId, setShareAnonymizedParseSamples });
    await flushPromises();
    applyParseImprovementSharingToggle({ enabled: false, userId, setShareAnonymizedParseSamples });
    applyParseImprovementSharingToggle({ enabled: true, userId, setShareAnonymizedParseSamples });

    expect(mockFlushPendingEmailParseImprovementSamples).toHaveBeenCalledTimes(1);
    resolveFirstFlush?.();
    await flushPromises();

    expect(mockFlushPendingEmailParseImprovementSamples).toHaveBeenCalledTimes(2);
  });
});
