// biome-ignore-all lint/suspicious/noExplicitAny: platform and service mocks use flexible shapes
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadConfirmedPrivateBackup } from "@/features/settings/lib/private-backup-upload";
import type { UserId } from "@/shared/types/branded";

const mockCreatePrivateBackup = vi.fn<(...args: any[]) => any>(() => ({ success: true }));
const mockGetItemAsync = vi.fn<(...args: any[]) => any>();
const mockSetItemAsync = vi.fn<(...args: any[]) => any>();
const platform = vi.hoisted(() => ({ OS: "ios" }));

vi.mock("@/features/backup/public", () => ({
  createPrivateBackup: (...args: any[]) => mockCreatePrivateBackup(...args),
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: (...args: any[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: any[]) => mockSetItemAsync(...args),
}));

vi.mock("expo-crypto", () => ({
  getRandomBytes: () => new Uint8Array([1, 2, 255]),
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.2.3" } },
}));

vi.mock("@/shared/components/rn", () => ({
  Platform: platform,
}));

vi.mock("@/shared/db", () => ({
  getDb: (userId: UserId) => ({ userId }),
  getSupabase: () => ({ supabase: true }),
}));

vi.mock("@/shared/lib", () => ({
  generateBackupId: () => "backup-1",
}));

vi.mock("@/shared/lib/format-date", () => ({
  toIsoDateTime: () => "2026-04-19T10:00:00.000Z",
}));

const input = {
  userId: "user-1" as UserId,
  recoveryKey: "recovery",
  confirmedRecoveryKey: "recovery",
};

describe("uploadConfirmedPrivateBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platform.OS = "ios";
  });

  it("reuses an existing trusted device secret", async () => {
    mockGetItemAsync.mockResolvedValue("existing-secret");

    await uploadConfirmedPrivateBackup(input);

    expect(mockSetItemAsync).not.toHaveBeenCalled();
    expect(mockCreatePrivateBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        trustedDeviceSecret: "existing-secret",
        deviceLabel: "iPhone",
        appVersion: "1.2.3",
      })
    );
  });

  it("creates a trusted device secret and labels Android devices", async () => {
    platform.OS = "android";
    mockGetItemAsync.mockResolvedValue("");

    await uploadConfirmedPrivateBackup(input);

    expect(mockSetItemAsync).toHaveBeenCalledWith(
      "private-backup-trusted-device-secret-user-1",
      "0102ff"
    );
    expect(mockCreatePrivateBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        trustedDeviceSecret: "0102ff",
        deviceLabel: "Android",
      })
    );
  });
});
