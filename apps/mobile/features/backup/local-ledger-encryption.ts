import type { BackupSnapshot } from "@/local-ledger/snapshot.public";
import {
  deriveWrappingKey,
  encodeJson,
  encryptAesGcm,
  getRandomBytes,
  toBase64,
  toHex,
} from "./local-ledger-crypto";
import { containsLocalLedgerBackupSecret } from "./local-ledger-secret-guard";

export const LOCAL_LEDGER_ENCRYPTED_BACKUP_VERSION = 1;

export type BackupWrappedDataKeyKind = "trusted_device" | "recovery_key";

export type EncryptedLocalLedgerBackupSnapshot = {
  readonly version: typeof LOCAL_LEDGER_ENCRYPTED_BACKUP_VERSION;
  readonly algorithm: "AES-GCM";
  readonly ciphertext: string;
  readonly nonce: string;
  readonly wrappedDataKeys: readonly BackupWrappedDataKey[];
};

export type BackupWrappedDataKey = {
  readonly kind: BackupWrappedDataKeyKind;
  readonly algorithm: "PBKDF2-SHA256+A256GCM";
  readonly salt: string;
  readonly nonce: string;
  readonly ciphertext: string;
  readonly iterations: number;
};

export type EncryptLocalLedgerBackupSnapshotOptions = {
  readonly trustedDeviceSecret: string;
  readonly recoveryKey?: string;
  readonly confirmedRecoveryKey?: string;
};

const DATA_KEY_BYTES = 32;
const GCM_NONCE_BYTES = 12;
const RECOVERY_KEY_PARTS = 6;
const RECOVERY_KEY_PART_BYTES = 2;
const WRAP_SALT_BYTES = 16;
const WRAP_ITERATIONS = 210_000;

export function generateBackupRecoveryKey(): string {
  return `RK-${Array.from({ length: RECOVERY_KEY_PARTS }, () =>
    toHex(getRandomBytes(RECOVERY_KEY_PART_BYTES))
  ).join("-")}`;
}

export async function encryptLocalLedgerBackupSnapshot(
  snapshot: BackupSnapshot,
  options: EncryptLocalLedgerBackupSnapshotOptions
): Promise<EncryptedLocalLedgerBackupSnapshot> {
  assertRecoveryKeyConfirmation(options);
  const dataKey = getRandomBytes(DATA_KEY_BYTES);
  const nonce = getRandomBytes(GCM_NONCE_BYTES);
  const [wrappedDataKeys, ciphertext] = await Promise.all([
    wrapDataKeyForBackup(dataKey, options),
    encryptAesGcm(dataKey, nonce, encodeJson(snapshot)),
  ]);

  return {
    version: LOCAL_LEDGER_ENCRYPTED_BACKUP_VERSION,
    algorithm: "AES-GCM",
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext),
    wrappedDataKeys,
  };
}

export function assertLocalLedgerBackupSecretSafeForRemote(value: unknown) {
  if (
    containsLocalLedgerBackupSecret(value, {
      encryptedBackupVersion: LOCAL_LEDGER_ENCRYPTED_BACKUP_VERSION,
    })
  ) {
    throw new Error("Local ledger backup secret cannot be sent to remote services");
  }
}

export function assertLocalLedgerBackupSecretSafeForLog(value: unknown) {
  if (
    containsLocalLedgerBackupSecret(value, {
      encryptedBackupVersion: LOCAL_LEDGER_ENCRYPTED_BACKUP_VERSION,
    })
  ) {
    throw new Error("Local ledger backup secret cannot be written to logs");
  }
}

function assertRecoveryKeyConfirmation(options: EncryptLocalLedgerBackupSnapshotOptions) {
  if (options.recoveryKey !== undefined && options.recoveryKey !== options.confirmedRecoveryKey) {
    throw new Error("Recovery Key confirmation does not match");
  }
}

async function wrapDataKeyForBackup(
  dataKey: Uint8Array,
  options: EncryptLocalLedgerBackupSnapshotOptions
): Promise<readonly BackupWrappedDataKey[]> {
  const trustedDeviceWrap = await wrapDataKey(
    dataKey,
    "trusted_device",
    options.trustedDeviceSecret
  );
  if (options.recoveryKey === undefined) {
    return [trustedDeviceWrap];
  }
  return [trustedDeviceWrap, await wrapDataKey(dataKey, "recovery_key", options.recoveryKey)];
}

async function wrapDataKey(
  dataKey: Uint8Array,
  kind: BackupWrappedDataKeyKind,
  secret: string
): Promise<BackupWrappedDataKey> {
  const salt = getRandomBytes(WRAP_SALT_BYTES);
  const nonce = getRandomBytes(GCM_NONCE_BYTES);
  const wrappingKey = await deriveWrappingKey(secret, salt, {
    keyBytes: DATA_KEY_BYTES,
    iterations: WRAP_ITERATIONS,
  });
  const ciphertext = await encryptAesGcm(wrappingKey, nonce, dataKey);
  return {
    kind,
    algorithm: "PBKDF2-SHA256+A256GCM",
    salt: toBase64(salt),
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext),
    iterations: WRAP_ITERATIONS,
  };
}
