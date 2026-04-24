import { describe, expect, it } from "vitest";
import type { BackupSnapshot } from "@/features/backup/public";
import {
  assertLocalLedgerBackupSecretSafeForLog,
  assertLocalLedgerBackupSecretSafeForRemote,
  type BackupDecryptError,
  decryptLocalLedgerBackupSnapshot,
  encryptLocalLedgerBackupSnapshot,
  generateBackupRecoveryKey,
  rotateLocalLedgerBackupRecoveryKey,
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
    processedEmails: [],
    processedCaptures: [],
    syncConflicts: [],
  },
} as unknown as BackupSnapshot;

describe("local ledger backup encryption", () => {
  it("creates an encrypted backup that a trusted device can unlock before a Recovery Key is saved", async () => {
    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
    });

    await expect(
      decryptLocalLedgerBackupSnapshot(encrypted, { trustedDeviceSecret: "device-held-secret" })
    ).resolves.toEqual(SNAPSHOT);
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

    await expect(decryptLocalLedgerBackupSnapshot(encrypted, { recoveryKey })).resolves.toEqual(
      SNAPSHOT
    );
    expect(encrypted.wrappedDataKeys.map((wrapped) => wrapped.kind)).toEqual([
      "trusted_device",
      "recovery_key",
    ]);
  });

  it("classifies a wrong Recovery Key without decrypting the snapshot", async () => {
    const recoveryKey = generateBackupRecoveryKey();
    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
      recoveryKey,
      confirmedRecoveryKey: recoveryKey,
    });

    await expect(
      decryptLocalLedgerBackupSnapshot(encrypted, { recoveryKey: "RK-wrong-key" })
    ).rejects.toMatchObject({
      failure: "wrong_recovery_key",
    } satisfies Partial<BackupDecryptError>);
  });

  it("classifies tampered snapshot ciphertext after a key unwraps", async () => {
    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
    });

    await expect(
      decryptLocalLedgerBackupSnapshot(
        { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -1)}!` },
        { trustedDeviceSecret: "device-held-secret" }
      )
    ).rejects.toMatchObject({
      failure: "tampered_ciphertext",
    } satisfies Partial<BackupDecryptError>);
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

  it("classifies malformed wrapped key metadata before trying recovery material", async () => {
    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
    });

    await expect(
      decryptLocalLedgerBackupSnapshot(
        {
          ...encrypted,
          wrappedDataKeys: [
            {
              kind: "trusted_device",
              algorithm: "PBKDF2-SHA256+A256GCM",
              salt: "salt",
              nonce: "nonce",
              ciphertext: "ciphertext",
              iterations: 1,
            },
          ],
        },
        { trustedDeviceSecret: "device-held-secret" }
      )
    ).rejects.toMatchObject({
      failure: "malformed_wrapped_key_metadata",
    } satisfies Partial<BackupDecryptError>);
  });

  it("classifies malformed wrapped key encoding before trying recovery material", async () => {
    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
    });

    await expect(
      decryptLocalLedgerBackupSnapshot(
        {
          ...encrypted,
          wrappedDataKeys: [{ ...encrypted.wrappedDataKeys[0]!, salt: "not base64" }],
        },
        { trustedDeviceSecret: "device-held-secret" }
      )
    ).rejects.toMatchObject({
      failure: "malformed_wrapped_key_metadata",
    } satisfies Partial<BackupDecryptError>);
  });

  it("rotates Recovery Key wrapping without changing encrypted snapshot ciphertext", async () => {
    const oldRecoveryKey = generateBackupRecoveryKey();
    const newRecoveryKey = generateBackupRecoveryKey();
    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
      recoveryKey: oldRecoveryKey,
      confirmedRecoveryKey: oldRecoveryKey,
    });

    const rotated = await rotateLocalLedgerBackupRecoveryKey(encrypted, {
      currentRecoveryKey: oldRecoveryKey,
      newRecoveryKey,
      confirmedNewRecoveryKey: newRecoveryKey,
    });

    expect(rotated.ciphertext).toBe(encrypted.ciphertext);
    await expect(
      decryptLocalLedgerBackupSnapshot(rotated, { recoveryKey: newRecoveryKey })
    ).resolves.toEqual(SNAPSHOT);
    await expect(
      decryptLocalLedgerBackupSnapshot(rotated, { recoveryKey: oldRecoveryKey })
    ).rejects.toMatchObject({
      failure: "wrong_recovery_key",
    } satisfies Partial<BackupDecryptError>);
  });

  it("rejects backup secrets before remote transport or logging", async () => {
    const recoveryKey = generateBackupRecoveryKey();
    const encrypted = await encryptLocalLedgerBackupSnapshot(SNAPSHOT, {
      trustedDeviceSecret: "device-held-secret",
      recoveryKey,
      confirmedRecoveryKey: recoveryKey,
    });

    expect(() => assertLocalLedgerBackupSecretSafeForRemote(encrypted)).not.toThrow();
    expect(() => assertLocalLedgerBackupSecretSafeForRemote(recoveryKey)).toThrow(
      "Local ledger backup secret cannot be sent to remote services"
    );
    expect(() => assertLocalLedgerBackupSecretSafeForLog(recoveryKey)).toThrow(
      "Local ledger backup secret cannot be written to logs"
    );
    expect(() => assertLocalLedgerBackupSecretSafeForRemote(SNAPSHOT)).toThrow(
      "Local ledger backup secret cannot be sent to remote services"
    );
    expect(() =>
      assertLocalLedgerBackupSecretSafeForRemote({ trustedDeviceSecret: "device-held-secret" })
    ).toThrow("Local ledger backup secret cannot be sent to remote services");
    expect(() =>
      assertLocalLedgerBackupSecretSafeForRemote({ ...encrypted, plaintext: SNAPSHOT })
    ).toThrow("Local ledger backup secret cannot be sent to remote services");
    expect(() =>
      assertLocalLedgerBackupSecretSafeForRemote({ ...encrypted, ciphertext: recoveryKey })
    ).toThrow("Local ledger backup secret cannot be sent to remote services");
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
