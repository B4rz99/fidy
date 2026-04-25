import { describe, expect, it, vi } from "vitest";
import type {
  BackupSnapshot,
  EncryptedLocalLedgerBackupSnapshot,
  RemoteBackupMetadata,
} from "@/features/backup/public";
import {
  createPrivateBackup,
  derivePrivateBackupHealth,
  rotatePrivateBackupRecoveryKeySafely,
} from "@/features/backup/public";
import { requireBackupId, requireIsoDateTime, requireUserId } from "@/shared/types/assertions";

const METADATA = {
  userId: requireUserId("user-1"),
  backupId: requireBackupId("backup-1"),
  createdAt: requireIsoDateTime("2026-04-25T12:00:00.000Z"),
  schemaVersion: 1,
  appVersion: "0.0.1",
  deviceLabel: "iPhone",
  ciphertextSizeBytes: 42,
  ciphertextSha256: "hash",
} satisfies RemoteBackupMetadata;

const ENCRYPTED_BACKUP = {
  version: 1,
  algorithm: "AES-GCM",
  nonce: "nonce",
  ciphertext: "ciphertext",
  wrappedDataKeys: [],
} satisfies EncryptedLocalLedgerBackupSnapshot;

const SNAPSHOT = {
  version: 1,
  exportedAt: "2026-04-25T12:00:00.000Z",
  data: {
    transactions: [],
    transfers: [],
    userCategories: [],
    financialAccounts: [],
    openingBalances: [],
    budgets: [],
    goals: [],
    goalContributions: [],
    captureEvidence: [],
    financialAccountIdentifiers: [],
    accountSuggestionDismissals: [],
    processedEmails: [],
    processedCaptures: [],
    syncConflicts: [],
  },
} satisfies BackupSnapshot;

describe("private backup health", () => {
  it("keeps Private Backup in warning state until the Recovery Key is confirmed", () => {
    expect(
      derivePrivateBackupHealth({
        latestBackup: METADATA,
        hasGeneratedRecoveryKey: true,
        isRecoveryKeyConfirmed: false,
        lastUploadFailedAt: null,
      })
    ).toEqual({ status: "recovery_key_not_confirmed", latestBackup: METADATA });
  });
});

describe("createPrivateBackup", () => {
  it("uploads the encrypted backup before returning ready metadata", async () => {
    const exportSnapshot = vi.fn().mockReturnValue(SNAPSHOT);
    const encryptSnapshot = vi.fn().mockResolvedValue(ENCRYPTED_BACKUP);
    const uploadBackup = vi.fn().mockResolvedValue(METADATA);

    await expect(
      createPrivateBackup({
        db: {} as Parameters<typeof createPrivateBackup>[0]["db"],
        supabase: {} as Parameters<typeof createPrivateBackup>[0]["supabase"],
        userId: METADATA.userId,
        backupId: METADATA.backupId,
        recoveryKey: "RK-current",
        confirmedRecoveryKey: "RK-current",
        trustedDeviceSecret: "device-secret",
        exportedAt: METADATA.createdAt,
        appVersion: METADATA.appVersion,
        deviceLabel: METADATA.deviceLabel,
        exportSnapshot,
        encryptSnapshot,
        uploadBackup,
      })
    ).resolves.toBe(METADATA);

    expect(uploadBackup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: METADATA.userId,
        backupId: METADATA.backupId,
        encryptedBackup: ENCRYPTED_BACKUP,
      })
    );
  });
});

describe("rotatePrivateBackupRecoveryKeySafely", () => {
  it("keeps the old backup metadata when replacement upload fails", async () => {
    const rotate = vi.fn().mockResolvedValue(ENCRYPTED_BACKUP);
    const uploadReplacement = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      rotatePrivateBackupRecoveryKeySafely({
        currentBackup: ENCRYPTED_BACKUP,
        currentMetadata: METADATA,
        currentRecoveryKey: "RK-old",
        newRecoveryKey: "RK-new",
        confirmedNewRecoveryKey: "RK-new",
        rotate,
        uploadReplacement,
      })
    ).rejects.toThrow("network down");

    expect(uploadReplacement).toHaveBeenCalledWith(ENCRYPTED_BACKUP);
  });
});
