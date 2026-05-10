// biome-ignore-all lint/style/useNamingConvention: mock exports must match library API names
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/shared/types/branded";

const PROJECT_ID = "78256cac-010c-40e8-a651-4cc4b6000e41";
const MOCK_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
const MOCK_USER_ID = "user-123" as UserId;

// --- Supabase mock ---
const mockUpsert = vi.fn<(...args: any[]) => any>(() => Promise.resolve({ error: null }));
const mockEq = vi.fn<(...args: any[]) => any>();

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
const mockGetExpoPushTokenAsync = vi.fn<(...args: any[]) => any>((_opts?: unknown) =>
  Promise.resolve({ data: MOCK_TOKEN })
);
const mockGetPermissionsAsync = vi.fn<(...args: any[]) => any>(() =>
  Promise.resolve({ status: "granted", granted: true, canAskAgain: true })
);
const mockGetDevicePushTokenAsync = vi.fn<(...args: any[]) => any>((_opts?: unknown) =>
  Promise.resolve()
);

vi.mock("expo-notifications", () => ({
  getExpoPushTokenAsync: (opts?: unknown) => mockGetExpoPushTokenAsync(opts),
  getDevicePushTokenAsync: (opts?: unknown) => mockGetDevicePushTokenAsync(opts),
  setNotificationHandler: vi.fn<(...args: any[]) => any>(),
  getPermissionsAsync: (...args: any[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({ status: "granted", granted: true, canAskAgain: true })
  ),
  scheduleNotificationAsync: vi.fn<(...args: any[]) => any>(),
  cancelScheduledNotificationAsync: vi.fn<(...args: any[]) => any>(),
  addPushTokenListener: vi.fn<(...args: any[]) => any>(),
  addNotificationResponseReceivedListener: vi.fn<(...args: any[]) => any>(),
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
    vi.useRealTimers();
    mockGetPermissionsAsync.mockResolvedValue({
      status: "granted",
      granted: true,
      canAskAgain: true,
    });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: MOCK_TOKEN });
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
        { onConflict: "user_id,expo_push_token" }
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

    it("does not request an Expo token before notification permission is granted", async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({
        status: "undetermined",
        granted: false,
        canAskAgain: true,
      });

      const { registerPushToken } = await import("@/features/notifications/services/push-token");

      const token = await registerPushToken(MOCK_USER_ID);

      expect(token).toBeNull();
      expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("retries canceled fetches when requesting the Expo push token", async () => {
      vi.useFakeTimers();
      mockGetExpoPushTokenAsync
        .mockRejectedValueOnce(new Error("fetch failed: Fetch request has been canceled"))
        .mockResolvedValueOnce({ data: MOCK_TOKEN });

      const { registerPushToken } = await import("@/features/notifications/services/push-token");
      const result = registerPushToken(MOCK_USER_ID);

      await vi.advanceTimersByTimeAsync(750);

      await expect(result).resolves.toBe(MOCK_TOKEN);
      expect(mockGetExpoPushTokenAsync).toHaveBeenCalledTimes(2);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ expo_push_token: MOCK_TOKEN }),
        { onConflict: "user_id,expo_push_token" }
      );
    });

    it("upserts known listener tokens without fetching a fresh Expo token", async () => {
      const { registerKnownPushToken } =
        await import("@/features/notifications/services/push-token");

      const token = await registerKnownPushToken(MOCK_USER_ID, MOCK_TOKEN);

      expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: MOCK_USER_ID,
          expo_push_token: MOCK_TOKEN,
        }),
        { onConflict: "user_id,expo_push_token" }
      );
      expect(token).toBe(MOCK_TOKEN);
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
