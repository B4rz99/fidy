// biome-ignore-all lint/suspicious/noExplicitAny: hook dependencies are mocked at module boundaries
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUserId } from "@/shared/types/assertions";

const mockDb = {} as any;
const mockRefreshTransactions = vi.fn<(...args: any[]) => any>();
const mockHydrateSettings = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const defaultSettingsState = {
  hydrate: mockHydrateSettings,
  isHydrated: true,
  shareAnonymizedParseSamples: false,
};
let settingsState = defaultSettingsState;
const mockUseSettingsStore = Object.assign(
  vi.fn<(...args: any[]) => any>((selector: any) => selector(settingsState)),
  {
    getState: () => settingsState,
  }
);
const mockInitializeEmailCaptureSession = vi.fn<(...args: any[]) => any>();
const mockLoadEmailAccounts = vi.fn<(...args: any[]) => any>();
const mockFetchAndProcessEmails = vi.fn<(...args: any[]) => any>();
const mockDeleteEmailParseImprovementSamplesForUser = vi.fn<(...args: any[]) => any>();
const mockRetryPendingEmailParseImprovementSampleDeletion = vi.fn<(...args: any[]) => any>();
const mockAddEventListener = vi.fn<(...args: any[]) => any>();

describe("useEmailCapture", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    settingsState = defaultSettingsState;
    mockLoadEmailAccounts.mockResolvedValue(undefined);
    mockHydrateSettings.mockResolvedValue(undefined);
    mockFetchAndProcessEmails.mockResolvedValue({
      status: "completed",
      savedCount: 0,
      needsReviewCount: 0,
      failedCount: 0,
    });
    mockRetryPendingEmailParseImprovementSampleDeletion.mockResolvedValue({
      deleted: 0,
      retried: false,
    });
    mockDeleteEmailParseImprovementSamplesForUser.mockResolvedValue({
      deleted: 0,
    });
    mockAddEventListener.mockReturnValue({ remove: vi.fn<(...args: any[]) => any>() });
  });

  it("initializes the email session before the app-open foreground fetch", async () => {
    const calls: string[] = [];
    mockInitializeEmailCaptureSession.mockImplementation(() => calls.push("init"));
    mockLoadEmailAccounts.mockImplementation(async () => {
      calls.push("loadAccounts");
    });
    mockFetchAndProcessEmails.mockImplementation(async () => {
      calls.push("fetch");
      return { status: "completed", savedCount: 0, needsReviewCount: 0, failedCount: 0 };
    });
    const { useEmailCapture } = await loadUseEmailCapture();
    const userId = requireUserId("user-1");

    useEmailCapture(mockDb, userId);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toEqual(["init", "loadAccounts", "fetch"]);
    expect(mockHydrateSettings).not.toHaveBeenCalled();
    expect(mockFetchAndProcessEmails).toHaveBeenCalledWith(
      mockDb,
      userId,
      "gmail-client-id",
      "outlook-client-id",
      expect.any(Function),
      {
        shareParseImprovementSamples: false,
        isShareParseImprovementSamplesEnabled: expect.any(Function),
        canDeleteDisabledParseImprovementSamples: expect.any(Function),
      }
    );
    const options = mockFetchAndProcessEmails.mock.calls[0]?.[5];
    expect(options.shareParseImprovementSamples).toBe(false);
    expect(options.isShareParseImprovementSamplesEnabled()).toBe(false);
    expect(options.canDeleteDisabledParseImprovementSamples()).toBe(true);
  });

  it("does not treat pre-hydration sharing false as an opt-out", async () => {
    settingsState = {
      ...defaultSettingsState,
      isHydrated: false,
      shareAnonymizedParseSamples: false,
    };
    const { useEmailCapture } = await loadUseEmailCapture();
    const userId = requireUserId("user-1");

    useEmailCapture(mockDb, userId);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockInitializeEmailCaptureSession).not.toHaveBeenCalled();
    expect(mockRetryPendingEmailParseImprovementSampleDeletion).not.toHaveBeenCalled();
    expect(mockDeleteEmailParseImprovementSamplesForUser).not.toHaveBeenCalled();
    expect(mockFetchAndProcessEmails).not.toHaveBeenCalled();
  });

  it("retries durable opt-out deletion on app open when sharing is disabled", async () => {
    const { useEmailCapture } = await loadUseEmailCapture();
    const userId = requireUserId("user-1");

    useEmailCapture(mockDb, userId);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRetryPendingEmailParseImprovementSampleDeletion).toHaveBeenCalledWith({
      db: mockDb,
      userId,
    });
    expect(mockDeleteEmailParseImprovementSamplesForUser).not.toHaveBeenCalled();
  });
});

async function loadUseEmailCapture() {
  vi.doMock("@/features/transactions/store.public", () => ({
    refreshTransactions: (...args: unknown[]) => mockRefreshTransactions(...args),
  }));
  vi.doMock("@/features/settings/hooks.public", () => ({
    useSettingsStore: mockUseSettingsStore,
  }));
  vi.doMock("@/shared/components/rn", () => ({
    AppState: { addEventListener: (...args: unknown[]) => mockAddEventListener(...args) },
  }));
  vi.doMock("@/shared/hooks", () => ({
    useSubscription: (subscribe: () => void, _deps: readonly unknown[], enabled: boolean) => {
      if (enabled) subscribe();
    },
  }));
  vi.doMock("@/shared/lib", () => ({
    handleRecoverableError: () => vi.fn<(...args: any[]) => any>(),
  }));
  vi.doMock("@/features/email-capture/schema", () => ({
    getGmailClientId: () => "gmail-client-id",
    getOutlookClientId: () => "outlook-client-id",
  }));
  vi.doMock("@/features/email-capture/store", () => ({
    fetchAndProcessEmails: (...args: unknown[]) => mockFetchAndProcessEmails(...args),
    initializeEmailCaptureSession: (...args: unknown[]) =>
      mockInitializeEmailCaptureSession(...args),
    loadEmailAccounts: (...args: unknown[]) => mockLoadEmailAccounts(...args),
  }));
  vi.doMock("@/features/email-capture/parse-improvement.public", () => ({
    deleteEmailParseImprovementSamplesForUser: (...args: unknown[]) =>
      mockDeleteEmailParseImprovementSamplesForUser(...args),
    retryPendingEmailParseImprovementSampleDeletion: (...args: unknown[]) =>
      mockRetryPendingEmailParseImprovementSampleDeletion(...args),
  }));

  return import("@/features/email-capture/hooks/useEmailCapture");
}
