import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn<(...args: any[]) => any>();
const mockGetDb = vi.fn<(...args: any[]) => any>(() => ({}));
const mockInitializeEmailCaptureSession = vi.fn<(...args: any[]) => any>();
const mockLoadEmailAccounts = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined);
const mockFetchAndProcessEmails = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined);
const mockHydrateSettings = vi.fn<(...args: any[]) => any>();
const mockGetSettingsState = vi.fn<(...args: any[]) => any>();

describe("background email fetch task", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "00000000-0000-4000-8000-000000000001" } } },
      error: null,
    });
    mockHydrateSettings.mockImplementation(async () => {
      mockGetSettingsState.mockReturnValue({
        hydrate: mockHydrateSettings,
        shareAnonymizedParseSamples: true,
      });
    });
    mockGetSettingsState.mockReturnValue({
      hydrate: mockHydrateSettings,
      shareAnonymizedParseSamples: false,
    });
  });

  it("hydrates settings before reading parse-improvement consent", async () => {
    const task = await loadBackgroundTask();

    const result = await task();

    expect(result).toBe(1);
    expect(mockHydrateSettings.mock.invocationCallOrder[0]).toBeLessThan(
      mockFetchAndProcessEmails.mock.invocationCallOrder[0] ?? 0
    );
    expect(mockFetchAndProcessEmails).toHaveBeenCalledWith(
      expect.anything(),
      "00000000-0000-4000-8000-000000000001",
      "gmail-client",
      "outlook-client",
      undefined,
      { parseProfile: "background", shareParseImprovementSamples: true }
    );
  });
});

async function loadBackgroundTask() {
  let task: (() => Promise<number>) | undefined;
  vi.doMock("expo-background-task", () => ({
    BackgroundTaskResult: { Success: 1, Failed: 2 },
  }));
  vi.doMock("expo-task-manager", () => ({
    defineTask: vi.fn<(...args: any[]) => any>((_name: string, handler: () => Promise<number>) => {
      task = handler;
    }),
  }));
  vi.doMock("@/features/email-capture/public", () => ({
    fetchAndProcessEmails: (...args: unknown[]) =>
      (mockFetchAndProcessEmails as (...args: unknown[]) => unknown)(...args),
    getGmailClientId: () => "gmail-client",
    getOutlookClientId: () => "outlook-client",
    initializeEmailCaptureSession: (...args: unknown[]) =>
      (mockInitializeEmailCaptureSession as (...args: unknown[]) => unknown)(...args),
    loadEmailAccounts: (...args: unknown[]) =>
      (mockLoadEmailAccounts as (...args: unknown[]) => unknown)(...args),
  }));
  vi.doMock("@/features/settings/hooks.public", () => ({
    useSettingsStore: { getState: () => mockGetSettingsState() },
  }));
  vi.doMock("@/shared/db", () => ({
    getDb: (...args: unknown[]) => (mockGetDb as (...args: unknown[]) => unknown)(...args),
    getSupabase: () => ({ auth: { getSession: mockGetSession } }),
  }));
  vi.doMock("@/shared/lib", () => ({ captureError: vi.fn<(...args: any[]) => any>() }));

  await import("@/features/background-fetch/task");
  if (!task) {
    throw new Error("Background task was not registered");
  }
  return task;
}
