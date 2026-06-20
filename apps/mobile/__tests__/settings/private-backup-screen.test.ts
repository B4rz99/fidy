import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Private Backup settings surface", () => {
  const settingsSource = readFileSync(
    resolve(__dirname, "../../features/settings/components/SettingsScreen.tsx"),
    "utf-8"
  );
  const screenSource = readFileSync(
    resolve(__dirname, "../../features/settings/components/PrivateBackupScreen.tsx"),
    "utf-8"
  );
  const statusPillSource = readFileSync(
    resolve(__dirname, "../../features/settings/components/PrivateBackupStatusPill.tsx"),
    "utf-8"
  );
  const routeSource = readFileSync(resolve(__dirname, "../../app/private-backup.tsx"), "utf-8");

  it("links settings to the Private Backup route", () => {
    expect(settingsSource).toContain('push("/private-backup")');
    expect(routeSource).toContain("PrivateBackupScreen");
  });

  it("uses user-facing Private Backup and Recovery Key copy", () => {
    expect(screenSource).toContain('t("privateBackup.title")');
    expect(screenSource).toContain('t("privateBackup.recoveryKeyLabel")');
    expect(screenSource).not.toMatch(/encryption setup/i);
  });

  it("uploads a real backup before marking Private Backup ready", () => {
    expect(screenSource).toContain("uploadConfirmedPrivateBackup");
    expect(screenSource).toContain(
      "confirmPrivateBackupRecoveryKey(confirmedRecoveryKey, metadata)"
    );
    expect(screenSource).not.toContain("buildPrivateBackupMetadata");
  });

  it("keeps Private Backup status colors and backup date honest", () => {
    expect(statusPillSource).toContain('const warning = useThemeColor("warning")');
    expect(statusPillSource).toContain('tone === "green" ? accentGreen : warning');
    expect(screenSource).toContain("health.latestBackup.createdAt");
    expect(screenSource).toContain('t("privateBackup.encryptedBackupBody",');
  });
});
