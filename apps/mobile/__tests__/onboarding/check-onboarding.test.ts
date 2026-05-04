// biome-ignore-all lint/style/useNamingConvention: Supabase API uses snake_case for user_metadata fields
import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearOnboardingFromStore,
  getOnboardingCompleteFromStore,
  isOnboardingComplete,
  markOnboardingComplete,
  resetOnboarding,
} from "@/features/onboarding/lib/check-onboarding";

const { mockDeleteItemAsync, mockGetItem, mockSetItemAsync, mockUpdateUser } = vi.hoisted(() => ({
  mockDeleteItemAsync: vi.fn((_key: string) => Promise.resolve()),
  mockGetItem: vi.fn((_key: string) => null as string | null),
  mockSetItemAsync: vi.fn((_key: string, _value: string) => Promise.resolve()),
  mockUpdateUser: vi.fn((_attributes: unknown) => Promise.resolve()),
}));

vi.mock("expo-secure-store", () => ({
  deleteItemAsync: (key: string) => mockDeleteItemAsync(key),
  getItem: (key: string) => mockGetItem(key),
  setItemAsync: (key: string, value: string) => mockSetItemAsync(key, value),
}));

vi.mock("@/shared/db", () => ({
  getSupabase: () => ({
    auth: {
      updateUser: (attributes: unknown) => mockUpdateUser(attributes),
    },
  }),
}));

const makeSession = (metadata?: Record<string, unknown>) =>
  ({
    user: {
      id: "user-123",
      user_metadata: metadata ?? {},
    },
  }) as unknown as Session;

describe("isOnboardingComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns true when onboarding_completed is true", () => {
    const session = makeSession({ onboarding_completed: true });
    expect(isOnboardingComplete(session)).toBe(true);
  });

  test("returns false for null session", () => {
    expect(isOnboardingComplete(null)).toBe(false);
  });

  test("returns false when metadata is missing", () => {
    const session = makeSession();
    expect(isOnboardingComplete(session)).toBe(false);
  });

  test("returns false when onboarding_completed is false", () => {
    const session = makeSession({ onboarding_completed: false });
    expect(isOnboardingComplete(session)).toBe(false);
  });

  test("reads the local completion flag from SecureStore", () => {
    mockGetItem.mockReturnValueOnce("true").mockReturnValueOnce("false");

    expect(getOnboardingCompleteFromStore()).toBe(true);
    expect(getOnboardingCompleteFromStore()).toBe(false);
    expect(mockGetItem).toHaveBeenCalledWith("onboarding_completed");
  });

  test("treats SecureStore read failures as incomplete", () => {
    mockGetItem.mockImplementationOnce(() => {
      throw new Error("secure store unavailable");
    });

    expect(getOnboardingCompleteFromStore()).toBe(false);
  });

  test("marks onboarding complete locally and best-effort remotely", async () => {
    await markOnboardingComplete();
    await vi.waitFor(() => expect(mockUpdateUser).toHaveBeenCalledOnce());

    expect(mockSetItemAsync).toHaveBeenCalledWith("onboarding_completed", "true");
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { onboarding_completed: true } });
  });

  test("does not fail completion when the remote metadata update fails", async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error("network down"));

    await expect(markOnboardingComplete()).resolves.toBeUndefined();
    await vi.waitFor(() => expect(mockUpdateUser).toHaveBeenCalledOnce());
  });

  test("clears local onboarding state without surfacing SecureStore failures", async () => {
    mockDeleteItemAsync.mockRejectedValueOnce(new Error("secure store unavailable"));

    await expect(clearOnboardingFromStore()).resolves.toBeUndefined();

    expect(mockDeleteItemAsync).toHaveBeenCalledWith("onboarding_completed");
  });

  test("resets onboarding locally and best-effort remotely", async () => {
    await resetOnboarding();

    expect(mockDeleteItemAsync).toHaveBeenCalledWith("onboarding_completed");
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { onboarding_completed: null } });
  });

  test("does not fail reset when the remote metadata update fails", async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error("network down"));

    await expect(resetOnboarding()).resolves.toBeUndefined();
  });
});
