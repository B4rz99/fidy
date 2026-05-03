// biome-ignore-all lint/suspicious/noExplicitAny: hook dependencies are mocked at module boundaries
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUserId } from "@/shared/types/assertions";

const mockDb = {} as any;
const mockRefreshTransactions = vi.fn();
const mockUseSettingsStore = Object.assign(
  vi.fn((selector: any) => selector({ shareAnonymizedParseSamples: false })),
  { getState: () => ({ shareAnonymizedParseSamples: false }) }
);
const mockInitializeEmailCaptureSession = vi.fn();
const mockLoadEmailAccounts = vi.fn();
const mockFetchAndProcessEmails = vi.fn();
const mockAddEventListener = vi.fn();

describe("useEmailCapture", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockLoadEmailAccounts.mockResolvedValue(undefined);
    mockFetchAndProcessEmails.mockResolvedValue({
      status: "completed",
      savedCount: 0,
      needsReviewCount: 0,
      failedCount: 0,
    });
    mockAddEventListener.mockReturnValue({ remove: vi.fn() });
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
    await Promise.resolve();

    expect(calls).toEqual(["init", "loadAccounts", "fetch"]);
    expect(mockFetchAndProcessEmails).toHaveBeenCalledWith(
      mockDb,
      userId,
      "gmail-client-id",
      "outlook-client-id",
      expect.any(Function),
      { shareParseImprovementSamples: false }
    );
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
    handleRecoverableError: () => vi.fn(),
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

  return import("@/features/email-capture/hooks/useEmailCapture");
}
