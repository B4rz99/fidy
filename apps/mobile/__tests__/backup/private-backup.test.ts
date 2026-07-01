import { describe, expect, it, vi } from "vitest";
import type {
  BackupSnapshot,
  EncryptedLocalLedgerBackupSnapshot,
  RemoteBackupMetadata,
} from "@/features/backup/public";
import { createPrivateBackup, derivePrivateBackupHealth } from "@/features/backup/public";
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
    categoryIconOverrides: [],
    categoryColorOverrides: [],
    financialAccounts: [],
    openingBalances: [],
    budgets: [],
    goals: [],
    goalContributions: [],
    captureEvidence: [],
    financialAccountIdentifiers: [],
    accountSuggestionDismissals: [],
    processedSourceEvents: [],
    reviewCandidates: [],
    reviewCandidateCaptureEvidence: [],
  },
} satisfies BackupSnapshot;

const SNAPSHOT_WITH_FINANCIAL_DATA = {
  ...SNAPSHOT,
  data: {
    ...SNAPSHOT.data,
    userCategories: [
      {
        id: "category-1",
        userId: "user-1",
        name: "Food",
        iconName: "utensils",
        colorHex: "#ff0000",
        createdAt: "2026-04-25T12:00:00.000Z",
        updatedAt: "2026-04-25T12:00:00.000Z",
        deletedAt: null,
        source: "local_ledger",
      },
    ] as unknown as BackupSnapshot["data"]["userCategories"],
    financialAccounts: [
      {
        id: "account-1",
        userId: "user-1",
        name: "Main checking",
        kind: "checking",
        isDefault: true,
        statementClosingDay: null,
        paymentDueDay: null,
        createdAt: "2026-04-25T12:00:00.000Z",
        updatedAt: "2026-04-25T12:00:00.000Z",
        deletedAt: null,
        source: "local_ledger",
      },
    ] as unknown as BackupSnapshot["data"]["financialAccounts"],
    transactions: [
      {
        id: "txn-1",
        userId: "user-1",
        type: "expense",
        amount: 42_000,
        categoryId: "category-1",
        description: "Lunch at El Prado",
        counterpartyName: null,
        date: "2026-04-25",
        accountId: "account-1",
        accountAttributionState: "confirmed",
        supersededAt: null,
        supersededByTransferId: null,
        createdAt: "2026-04-25T12:00:00.000Z",
        updatedAt: "2026-04-25T12:00:00.000Z",
        voidedAt: null,
        source: "manual",
      },
    ] as unknown as BackupSnapshot["data"]["transactions"],
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
    const exportSnapshot = vi.fn<(...args: any[]) => any>().mockReturnValue(SNAPSHOT);
    const encryptSnapshot = vi.fn<(...args: any[]) => any>().mockResolvedValue(ENCRYPTED_BACKUP);
    const uploadBackup = vi.fn<(...args: any[]) => any>().mockResolvedValue(METADATA);

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

  it("sends only encrypted payloads and remote metadata to backup upload", async () => {
    const exportSnapshot = vi
      .fn<(...args: any[]) => any>()
      .mockReturnValue(SNAPSHOT_WITH_FINANCIAL_DATA);
    const encryptSnapshot = vi.fn<(...args: any[]) => any>().mockResolvedValue(ENCRYPTED_BACKUP);
    const uploadBackup = vi.fn<(...args: any[]) => any>().mockResolvedValue(METADATA);

    await createPrivateBackup(
      privateBackupInput({ exportSnapshot, encryptSnapshot, uploadBackup })
    );

    const remotePayload = JSON.stringify(uploadBackup.mock.calls);

    expect(uploadBackup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        encryptedBackup: ENCRYPTED_BACKUP,
      })
    );
    expect(remotePayload).not.toContain("Lunch at El Prado");
    expect(remotePayload).not.toContain("txn-1");
    expect(remotePayload).not.toContain("RK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF");
    expect(remotePayload).not.toContain("trusted-device-secret");
  });

  it("refuses to encrypt or upload an invalid local ledger snapshot", async () => {
    const exportSnapshot = vi.fn<(...args: any[]) => any>().mockReturnValue({
      ...SNAPSHOT,
      version: 999,
    });
    const encryptSnapshot = vi.fn<(...args: any[]) => any>().mockResolvedValue(ENCRYPTED_BACKUP);
    const uploadBackup = vi.fn<(...args: any[]) => any>().mockResolvedValue(METADATA);

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
    ).rejects.toThrow("Unsupported local ledger backup snapshot version: 999");

    expect(encryptSnapshot).not.toHaveBeenCalled();
    expect(uploadBackup).not.toHaveBeenCalled();
  });
});

function privateBackupInput(
  overrides: Pick<
    Parameters<typeof createPrivateBackup>[0],
    "encryptSnapshot" | "exportSnapshot" | "uploadBackup"
  >
): Parameters<typeof createPrivateBackup>[0] {
  return {
    db: {} as Parameters<typeof createPrivateBackup>[0]["db"],
    supabase: {} as Parameters<typeof createPrivateBackup>[0]["supabase"],
    userId: METADATA.userId,
    backupId: METADATA.backupId,
    recoveryKey: "RK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF",
    confirmedRecoveryKey: "RK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF",
    trustedDeviceSecret: "trusted-device-secret",
    exportedAt: METADATA.createdAt,
    appVersion: METADATA.appVersion,
    deviceLabel: METADATA.deviceLabel,
    ...overrides,
  };
}
