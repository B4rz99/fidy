import { describe, expect, it } from "vitest";
import type { BackupSnapshot } from "@/features/backup/public";
import {
  assertLocalLedgerBackupSecretSafeForLog,
  assertLocalLedgerBackupSecretSafeForRemote,
  encryptLocalLedgerBackupSnapshot,
  generateBackupRecoveryKey,
} from "@/features/backup/public";

const SNAPSHOT = {
  version: 1,
  exportedAt: "2026-04-23T10:30:00.000Z",
  data: {
    transactions: [{ id: "txn-1", description: "Lunch", amount: 42000 }],
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
  },
} as unknown as BackupSnapshot;

describe("local ledger backup encryption", () => {
  it("creates an encrypted backup before a Recovery Key is saved", async () => {
    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
    });

    expect(encrypted.wrappedDataKeys.map((wrapped) => wrapped.kind)).toEqual(["trusted_device"]);
    expect(JSON.stringify(encrypted)).not.toContain("Lunch");
    expect(JSON.stringify(encrypted)).not.toContain("txn-1");
  });

  it("adds a confirmed Recovery Key so a new device can unlock the backup", async () => {
    const recoveryKey = generateBackupRecoveryKey();

    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
      recoveryKey,
      confirmedRecoveryKey: recoveryKey,
    });

    expect(encrypted.wrappedDataKeys.map((wrapped) => wrapped.kind)).toEqual([
      "trusted_device",
      "recovery_key",
    ]);
  });

  it("requires Recovery Key confirmation before marking a backup fully recoverable", async () => {
    await expect(
      encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
        trustedDeviceSecret: "device-held-secret",
        recoveryKey: "RK-current",
        confirmedRecoveryKey: "RK-different",
      })
    ).rejects.toThrow("Recovery Key confirmation does not match");
  });

  it("rejects backup secrets before remote transport or logging", async () => {
    const recoveryKey = generateBackupRecoveryKey();
    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
      recoveryKey,
      confirmedRecoveryKey: recoveryKey,
    });

    expect(() => assertLocalLedgerBackupSecretSafeForRemote(encrypted)).not.toThrow();
    expectRemoteSecretRejection(recoveryKey);
    expect(() => assertLocalLedgerBackupSecretSafeForLog(recoveryKey)).toThrow(
      "Local ledger backup secret cannot be written to logs"
    );
    expectRemoteSecretRejection(SNAPSHOT);
    expectRemoteSecretRejection({ trustedDeviceSecret: "device-held-secret" });
    expectRemoteSecretRejection({ ...encrypted, plaintext: SNAPSHOT });
    expectRemoteSecretRejection({ ...encrypted, ciphertext: recoveryKey });
    expectRemoteSecretRejection({
      ...encrypted,
      wrappedDataKeys: [{ ...encrypted.wrappedDataKeys[0]!, rawKey: recoveryKey }],
    });
  });

  it("handles cyclic payloads while checking for backup secrets", async () => {
    const recoveryKey = generateBackupRecoveryKey();
    const cyclicPayload: Record<string, unknown> = {};
    cyclicPayload.self = cyclicPayload;

    expect(() => assertLocalLedgerBackupSecretSafeForRemote(cyclicPayload)).not.toThrow();
    cyclicPayload.recoveryKey = recoveryKey;
    expect(() => assertLocalLedgerBackupSecretSafeForRemote(cyclicPayload)).toThrow(
      "Local ledger backup secret cannot be sent to remote services"
    );
  });
});

function expectRemoteSecretRejection(value: unknown) {
  expect(() => assertLocalLedgerBackupSecretSafeForRemote(value)).toThrow(
    "Local ledger backup secret cannot be sent to remote services"
  );
}
