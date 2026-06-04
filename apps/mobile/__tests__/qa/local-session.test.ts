import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLocalQaSession,
  isLocalQaAvailable,
  loadLocalQaSession,
  persistLocalQaSession,
} from "@/features/qa/local-session";
import type { LocalQaSession } from "@/features/qa/session.public";
import type { UserId } from "@/shared/types/branded";

const mockGetItemAsync = vi.fn<() => Promise<string | null>>();
const mockSetItemAsync = vi.fn<(...args: string[]) => Promise<void>>();
const mockDeleteItemAsync = vi.fn<(key: string) => Promise<void>>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: () => mockGetItemAsync(),
  setItemAsync: (...args: string[]) => mockSetItemAsync(...args),
  deleteItemAsync: (key: string) => mockDeleteItemAsync(key),
}));

const originalEnv = { ...process.env };
const session: LocalQaSession = {
  userId: "local-user" as UserId,
  profile: "transfer-ready",
  onboardingComplete: true,
  displayName: "Local QA",
  email: "qa@example.com",
};

describe("local QA session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.EXPO_PUBLIC_APP_ENV;
    delete process.env.EXPO_PUBLIC_ENABLE_LOCAL_QA;
    // biome-ignore lint/style/useNamingConvention: React Native global flag
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  });

  it("loads a valid persisted session", async () => {
    mockGetItemAsync.mockResolvedValue(JSON.stringify(session));

    await expect(loadLocalQaSession()).resolves.toEqual(session);
  });

  it("returns null for missing, malformed, and invalid persisted sessions", async () => {
    mockGetItemAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("{")
      .mockResolvedValueOnce(JSON.stringify({ ...session, profile: "unknown" }))
      .mockResolvedValueOnce(JSON.stringify({ ...session, onboardingComplete: "yes" }));

    await expect(loadLocalQaSession()).resolves.toBeNull();
    await expect(loadLocalQaSession()).resolves.toBeNull();
    await expect(loadLocalQaSession()).resolves.toBeNull();
    await expect(loadLocalQaSession()).resolves.toBeNull();
  });

  it("returns null when SecureStore read fails", async () => {
    mockGetItemAsync.mockRejectedValue(new Error("secure store unavailable"));

    await expect(loadLocalQaSession()).resolves.toBeNull();
  });

  it("skips SecureStore in production builds", async () => {
    process.env.EXPO_PUBLIC_APP_ENV = "production";

    expect(isLocalQaAvailable()).toBe(false);
    await expect(loadLocalQaSession()).resolves.toBeNull();
    await persistLocalQaSession(session);
    await clearLocalQaSession();

    expect(mockGetItemAsync).not.toHaveBeenCalled();
    expect(mockSetItemAsync).not.toHaveBeenCalled();
    expect(mockDeleteItemAsync).not.toHaveBeenCalled();
  });

  it("persists and clears available local QA sessions", async () => {
    await persistLocalQaSession(session);
    await clearLocalQaSession();

    expect(mockSetItemAsync).toHaveBeenCalledWith("qa_local_session_v1", JSON.stringify(session));
    expect(mockDeleteItemAsync).toHaveBeenCalledWith("qa_local_session_v1");
  });
});
