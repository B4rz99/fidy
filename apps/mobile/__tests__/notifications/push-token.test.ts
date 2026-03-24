// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/shared/types/branded";

const PROJECT_ID = "78256cac-010c-40e8-a651-4cc4b6000e41";
const MOCK_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
const MOCK_USER_ID = "user-123" as UserId;

// --- Supabase mock ---
const mockUpsert = vi.fn(() => Promise.resolve({ error: null }));
const mockEq = vi.fn();

vi.mock("@/shared/db/supabase", () => ({
  getSupabase: () => ({
    from: (table: string) => {
      if (table === "push_devices") {
        return {
          upsert: mockUpsert,
          delete: () => ({ eq: mockEq }),
        };
      }
      return {};
    },
  }),
}));

// --- expo-notifications mock ---
const mockGetExpoPushTokenAsync = vi.fn((_opts?: unknown) => Promise.resolve({ data: MOCK_TOKEN }));
const mockGetDevicePushTokenAsync = vi.fn((_opts?: unknown) => Promise.resolve());

vi.mock("expo-notifications", () => ({
  getExpoPushTokenAsync: (opts?: unknown) => mockGetExpoPushTokenAsync(opts),
  getDevicePushTokenAsync: (opts?: unknown) => mockGetDevicePushTokenAsync(opts),
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(() =>
    Promise.resolve({ status: "granted", granted: true, canAskAgain: true })
  ),
  requestPermissionsAsync: vi.fn(() =>
    Promise.resolve({ status: "granted", granted: true, canAskAgain: true })
  ),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  addPushTokenListener: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
}));

// --- expo-constants mock ---
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      version: "1.2.3",
      extra: { eas: { projectId: PROJECT_ID } },
    },
  },
}));

describe("push-token service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue(Promise.resolve({ error: null }));
  });

  describe("registerPushToken", () => {
    it("calls getExpoPushTokenAsync with the project ID and upserts to Supabase", async () => {
      const { registerPushToken } = await import("@/features/notifications/services/push-token");

      const token = await registerPushToken(MOCK_USER_ID);

      expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
      });
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: MOCK_USER_ID,
          expo_push_token: MOCK_TOKEN,
          platform: "ios",
          app_version: "1.2.3",
        }),
        { onConflict: "expo_push_token" }
      );
      expect(token).toBe(MOCK_TOKEN);
    });

    it("returns null when getExpoPushTokenAsync fails", async () => {
      mockGetExpoPushTokenAsync.mockRejectedValueOnce(
        new Error("Push notifications not available")
      );

      const { registerPushToken } = await import("@/features/notifications/services/push-token");

      const token = await registerPushToken(MOCK_USER_ID);
      expect(token).toBeNull();
    });

    it("returns null when Supabase upsert fails", async () => {
      mockUpsert.mockResolvedValueOnce({
        error: { message: "DB error" } as unknown as null,
      });

      const { registerPushToken } = await import("@/features/notifications/services/push-token");

      const token = await registerPushToken(MOCK_USER_ID);
      expect(token).toBeNull();
    });
  });

  describe("deletePushToken", () => {
    it("deletes from Supabase where expo_push_token matches", async () => {
      const { deletePushToken } = await import("@/features/notifications/services/push-token");

      await deletePushToken(MOCK_TOKEN);

      expect(mockEq).toHaveBeenCalledWith("expo_push_token", MOCK_TOKEN);
    });

    it("does not throw when Supabase delete fails", async () => {
      mockEq.mockReturnValue(Promise.resolve({ error: { message: "network error" } }));

      const { deletePushToken } = await import("@/features/notifications/services/push-token");

      await expect(deletePushToken(MOCK_TOKEN)).resolves.toBeUndefined();
    });
  });
});
