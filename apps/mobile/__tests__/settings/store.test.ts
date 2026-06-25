import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  isAuthoritativeParseImprovementOptOut,
  isExplicitParseImprovementOptIn,
  useSettingsStore,
} from "@/features/settings/store";
import { Appearance } from "@/shared/components/rn";
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
    expect(initial.isHydrated).toBe(false);
    expect(initial.notificationPreferences).toEqual({
      budgetAlerts: true,
      goalMilestones: true,
      spendingAnomalies: true,
    });
    expect(initial.shareAnonymizedParseSamples).toBe(false);
    expect(initial.parseImprovementSharingPreferenceState).toBe("unhydrated");
  });

  beforeEach(() => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    vi.mocked(SecureStore.setItemAsync).mockClear();
    vi.mocked(Appearance.setColorScheme).mockClear();
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
    expect(useSettingsStore.getState().parseImprovementSharingPreferenceState).toBe(
      "explicit_enabled"
    );
    expect(isExplicitParseImprovementOptIn(useSettingsStore.getState())).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("share_anonymized_parse_samples", "true");
  });

  test("hydrates explicit anonymized parse sample sharing opt-in", async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation((key) =>
      Promise.resolve(key === "share_anonymized_parse_samples" ? "true" : null)
    );

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().shareAnonymizedParseSamples).toBe(true);
    expect(useSettingsStore.getState().parseImprovementSharingPreferenceState).toBe(
      "explicit_enabled"
    );
    expect(isExplicitParseImprovementOptIn(useSettingsStore.getState())).toBe(true);
  });

  test("hydrates explicit anonymized parse sample sharing opt-out", async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation((key) =>
      Promise.resolve(key === "share_anonymized_parse_samples" ? "false" : null)
    );

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().shareAnonymizedParseSamples).toBe(false);
    expect(useSettingsStore.getState().parseImprovementSharingPreferenceState).toBe(
      "explicit_disabled"
    );
    expect(isAuthoritativeParseImprovementOptOut(useSettingsStore.getState())).toBe(true);
  });

  test("hydrates missing anonymized parse sample sharing preference as default enabled", async () => {
    expect(useSettingsStore.getState().shareAnonymizedParseSamples).toBe(false);

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().shareAnonymizedParseSamples).toBe(true);
    expect(useSettingsStore.getState().parseImprovementSharingPreferenceState).toBe(
      "default_enabled"
    );
    expect(isExplicitParseImprovementOptIn(useSettingsStore.getState())).toBe(false);
    expect(isAuthoritativeParseImprovementOptOut(useSettingsStore.getState())).toBe(false);
  });

  test("does not reopen sharing when storage is missing after an explicit opt-out", async () => {
    useSettingsStore.getState().setShareAnonymizedParseSamples(false);

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().shareAnonymizedParseSamples).toBe(false);
    expect(useSettingsStore.getState().parseImprovementSharingPreferenceState).toBe(
      "explicit_disabled"
    );
    expect(isAuthoritativeParseImprovementOptOut(useSettingsStore.getState())).toBe(true);
  });

  test("does not treat SecureStore hydration failure as an authoritative opt-out", async () => {
    vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error("locked"));

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().isHydrated).toBe(true);
    expect(useSettingsStore.getState().shareAnonymizedParseSamples).toBe(false);
    expect(useSettingsStore.getState().parseImprovementSharingPreferenceState).toBe("unavailable");
    expect(isAuthoritativeParseImprovementOptOut(useSettingsStore.getState())).toBe(false);
  });

  test("hydrates missing theme preference as system before first render", async () => {
    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().themePreference).toBe("system");
    expect(useSettingsStore.getState().isHydrated).toBe(true);
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("unspecified");
  });

  test("hydrates stored theme preference before first render", async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation((key) =>
      Promise.resolve(key === "theme_preference" ? "dark" : null)
    );

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().themePreference).toBe("dark");
    expect(useSettingsStore.getState().isHydrated).toBe(true);
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("dark");
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

  test("ignores invalid Private Backup storage without dropping unrelated settings", async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation((key) =>
      Promise.resolve(
        key === "theme_preference"
          ? "dark"
          : key === "share_anonymized_parse_samples"
            ? "true"
            : key === "private_backup"
              ? "{"
              : null
      )
    );

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().privateBackup.health.status).toBe("not_set_up");
    expect(useSettingsStore.getState().themePreference).toBe("dark");
    expect(useSettingsStore.getState().shareAnonymizedParseSamples).toBe(true);
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
