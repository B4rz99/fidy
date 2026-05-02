import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSettingsStore } from "@/features/settings/store";
import { requireBackupId, requireIsoDateTime, requireUserId } from "@/shared/types/assertions";

const BACKUP_METADATA = {
  userId: requireUserId("user-1"),
  backupId: requireBackupId("backup-1"),
  createdAt: requireIsoDateTime("2026-04-25T12:00:00.000Z"),
  schemaVersion: 1,
  appVersion: "0.0.1",
  deviceLabel: "iPhone",
  ciphertextSizeBytes: 42,
  ciphertextSha256: "hash",
};

describe("useSettingsStore", () => {
  test("has correct initial defaults", () => {
    // Mutate to non-defaults first to prove getInitialState is independent
    useSettingsStore.setState({
      themePreference: "dark",
    });
    const initial = useSettingsStore.getInitialState();
    expect(initial.themePreference).toBe("system");
    expect(initial.notificationPreferences).toEqual({
      budgetAlerts: true,
      goalMilestones: true,
      spendingAnomalies: true,
      weeklyDigest: true,
    });
    expect(initial.shareAnonymizedParseSamples).toBe(false);
  });

  beforeEach(() => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(SecureStore.setItemAsync).mockClear();
    useSettingsStore.setState(useSettingsStore.getInitialState());
  });

  test("setThemePreference updates state", () => {
    useSettingsStore.getState().setThemePreference("dark");
    expect(useSettingsStore.getState().themePreference).toBe("dark");
  });

  test("setThemePreference to light", () => {
    useSettingsStore.getState().setThemePreference("light");
    expect(useSettingsStore.getState().themePreference).toBe("light");
  });

  test("setNotificationPreference updates one preference", () => {
    useSettingsStore.getState().setNotificationPreference("budgetAlerts", false);
    expect(useSettingsStore.getState().notificationPreferences.budgetAlerts).toBe(false);
    expect(useSettingsStore.getState().notificationPreferences.goalMilestones).toBe(true);
  });

  test("setShareAnonymizedParseSamples persists privacy preference", () => {
    useSettingsStore.getState().setShareAnonymizedParseSamples(true);

    expect(useSettingsStore.getState().shareAnonymizedParseSamples).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("share_anonymized_parse_samples", "true");
  });

  test("hydrates anonymized parse sample sharing preference", async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation((key) =>
      Promise.resolve(key === "share_anonymized_parse_samples" ? "true" : null)
    );

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().shareAnonymizedParseSamples).toBe(true);
  });

  test("tracks Private Backup setup until the Recovery Key is confirmed", () => {
    useSettingsStore.getState().beginPrivateBackupSetup("RK-test-key");
    expect(useSettingsStore.getState().privateBackup.health.status).toBe(
      "recovery_key_not_confirmed"
    );

    useSettingsStore.getState().confirmPrivateBackupRecoveryKey("RK-test-key", BACKUP_METADATA);
    expect(useSettingsStore.getState().privateBackup.health.status).toBe("ready");
  });

  test("persists confirmed Private Backup state", () => {
    useSettingsStore.getState().beginPrivateBackupSetup("RK-test-key");
    useSettingsStore.getState().confirmPrivateBackupRecoveryKey("RK-test-key", BACKUP_METADATA);

    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(
      "private_backup",
      JSON.stringify({
        generatedRecoveryKey: "RK-test-key",
        isRecoveryKeyConfirmed: true,
        latestBackup: BACKUP_METADATA,
        lastUploadFailedAt: null,
      })
    );
  });

  test("hydrates persisted Private Backup health", async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation((key) =>
      Promise.resolve(
        key === "private_backup"
          ? JSON.stringify({
              generatedRecoveryKey: "RK-test-key",
              isRecoveryKeyConfirmed: true,
              latestBackup: BACKUP_METADATA,
              lastUploadFailedAt: null,
            })
          : null
      )
    );

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().privateBackup.health).toMatchObject({
      status: "ready",
      latestBackup: BACKUP_METADATA,
    });
  });

  test("keeps failed Private Backup uploads retryable", () => {
    useSettingsStore.getState().markPrivateBackupUploadFailed("2026-04-25T12:05:00.000Z");
    expect(useSettingsStore.getState().privateBackup.health).toMatchObject({
      status: "backup_failed",
      failedAt: "2026-04-25T12:05:00.000Z",
    });

    useSettingsStore.getState().markPrivateBackupUploadReady(BACKUP_METADATA);
    expect(useSettingsStore.getState().privateBackup.health.status).toBe("ready");
  });
});
