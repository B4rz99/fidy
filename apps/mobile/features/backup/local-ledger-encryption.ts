import {
  decodeUtf8,
  decryptAesGcm,
  deriveWrappingKey,
  encodeJson,
  encryptAesGcm,
  fromBase64,
  getRandomBytes,
  toBase64,
  toHex,
} from "./local-ledger-crypto";
import { isEncryptedBackupMetadataValid } from "./local-ledger-encryption-metadata";
import { containsLocalLedgerBackupSecret } from "./local-ledger-secret-guard";
import type { BackupSnapshot } from "./local-ledger-snapshot";

export const LOCAL_LEDGER_ENCRYPTED_BACKUP_VERSION = 1;

export type BackupDecryptFailure =
  | "wrong_recovery_key"
  | "wrong_trusted_device_secret"
  | "missing_key_material"
  | "tampered_ciphertext"
  | "malformed_wrapped_key_metadata";

export class BackupDecryptError extends Error {
  constructor(readonly failure: BackupDecryptFailure) {
    super(`Unable to decrypt local ledger backup: ${failure}`);
    this.name = "BackupDecryptError";
  }
}

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

export type DecryptLocalLedgerBackupSnapshotOptions = {
  readonly trustedDeviceSecret?: string;
  readonly recoveryKey?: string;
};

export type RotateLocalLedgerBackupRecoveryKeyOptions = {
  readonly currentRecoveryKey: string;
  readonly newRecoveryKey: string;
  readonly confirmedNewRecoveryKey: string;
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
  const wrappedDataKeys = await wrapDataKeyForBackup(dataKey, options);
  const ciphertext = await encryptAesGcm(dataKey, nonce, encodeJson(snapshot));

  return {
    version: LOCAL_LEDGER_ENCRYPTED_BACKUP_VERSION,
    algorithm: "AES-GCM",
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext),
    wrappedDataKeys,
  };
}

export async function decryptLocalLedgerBackupSnapshot(
  encrypted: EncryptedLocalLedgerBackupSnapshot,
  options: DecryptLocalLedgerBackupSnapshotOptions
): Promise<BackupSnapshot> {
  assertEncryptedBackupMetadata(encrypted);
  const dataKey = await unwrapDataKey(encrypted.wrappedDataKeys, options);
  const plaintext = await decryptSnapshotCiphertext(encrypted, dataKey);
  return JSON.parse(decodeUtf8(plaintext)) as BackupSnapshot;
}

export async function rotateLocalLedgerBackupRecoveryKey(
  encrypted: EncryptedLocalLedgerBackupSnapshot,
  options: RotateLocalLedgerBackupRecoveryKeyOptions
): Promise<EncryptedLocalLedgerBackupSnapshot> {
  assertRecoveryKeyConfirmation({
    trustedDeviceSecret: "already-wrapped",
    recoveryKey: options.newRecoveryKey,
    confirmedRecoveryKey: options.confirmedNewRecoveryKey,
  });
  assertEncryptedBackupMetadata(encrypted);
  const dataKey = await unwrapDataKey(encrypted.wrappedDataKeys, {
    recoveryKey: options.currentRecoveryKey,
  });
  const nonRecoveryKeyWraps = encrypted.wrappedDataKeys.filter(
    (wrapped) => wrapped.kind !== "recovery_key"
  );
  return {
    ...encrypted,
    wrappedDataKeys: [
      ...nonRecoveryKeyWraps,
      await wrapDataKey(dataKey, "recovery_key", options.newRecoveryKey),
    ],
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

async function unwrapDataKey(
  wrappedDataKeys: readonly BackupWrappedDataKey[],
  options: DecryptLocalLedgerBackupSnapshotOptions
): Promise<Uint8Array> {
  const candidates = getUnwrapCandidates(wrappedDataKeys, options);
  if (candidates.length === 0) {
    throw new BackupDecryptError("missing_key_material");
  }
  return unwrapFirstCandidate(candidates);
}

async function unwrapFirstCandidate(
  candidates: readonly { readonly wrappedDataKey: BackupWrappedDataKey; readonly secret: string }[]
): Promise<Uint8Array> {
  const [candidate, ...rest] = candidates;
  if (candidate === undefined) {
    throw new BackupDecryptError("missing_key_material");
  }

  try {
    const wrappingKey = await deriveWrappingKey(
      candidate.secret,
      fromBase64(candidate.wrappedDataKey.salt),
      {
        keyBytes: DATA_KEY_BYTES,
        iterations: WRAP_ITERATIONS,
      }
    );
    return await decryptAesGcm(
      wrappingKey,
      fromBase64(candidate.wrappedDataKey.nonce),
      fromBase64(candidate.wrappedDataKey.ciphertext)
    );
  } catch {
    if (rest.length > 0) {
      return unwrapFirstCandidate(rest);
    }
    throw new BackupDecryptError(failureForWrappedKeyKind(candidate.wrappedDataKey.kind));
  }
}

function getUnwrapCandidates(
  wrappedDataKeys: readonly BackupWrappedDataKey[],
  options: DecryptLocalLedgerBackupSnapshotOptions
) {
  return wrappedDataKeys.flatMap((wrappedDataKey) => {
    if (wrappedDataKey.kind === "trusted_device" && options.trustedDeviceSecret !== undefined) {
      return [{ wrappedDataKey, secret: options.trustedDeviceSecret }];
    }
    if (wrappedDataKey.kind === "recovery_key" && options.recoveryKey !== undefined) {
      return [{ wrappedDataKey, secret: options.recoveryKey }];
    }
    return [];
  });
}

function failureForWrappedKeyKind(kind: BackupWrappedDataKeyKind): BackupDecryptFailure {
  return kind === "recovery_key" ? "wrong_recovery_key" : "wrong_trusted_device_secret";
}

async function decryptSnapshotCiphertext(
  encrypted: EncryptedLocalLedgerBackupSnapshot,
  dataKey: Uint8Array
): Promise<Uint8Array> {
  try {
    return await decryptAesGcm(
      dataKey,
      fromBase64(encrypted.nonce),
      fromBase64(encrypted.ciphertext)
    );
  } catch {
    throw new BackupDecryptError("tampered_ciphertext");
  }
}

function assertEncryptedBackupMetadata(
  encrypted: EncryptedLocalLedgerBackupSnapshot
): asserts encrypted is EncryptedLocalLedgerBackupSnapshot {
  if (!isEncryptedBackupMetadataValid(encrypted, metadataValidationOptions)) {
    throw new BackupDecryptError("malformed_wrapped_key_metadata");
  }
}

const metadataValidationOptions = {
  encryptedBackupVersion: LOCAL_LEDGER_ENCRYPTED_BACKUP_VERSION,
  wrapIterations: WRAP_ITERATIONS,
};
