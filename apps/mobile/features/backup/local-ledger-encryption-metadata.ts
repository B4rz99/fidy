import { isBase64String } from "./local-ledger-crypto";
import type {
  BackupWrappedDataKey,
  EncryptedLocalLedgerBackupSnapshot,
} from "./local-ledger-encryption";

export function isEncryptedBackupMetadataValid(
  encrypted: EncryptedLocalLedgerBackupSnapshot,
  options: {
    readonly encryptedBackupVersion: number;
    readonly wrapIterations: number;
  }
) {
  return (
    metadataScalarsAreValid(encrypted, options.encryptedBackupVersion) &&
    wrappedDataKeysAreValid(encrypted.wrappedDataKeys, options.wrapIterations)
  );
}

function isValidWrappedDataKey(
  wrappedDataKey: unknown,
  wrapIterations: number
): wrappedDataKey is BackupWrappedDataKey {
  const record = toRecord(wrappedDataKey);
  return record !== null && wrappedDataKeyRecordIsValid(record, wrapIterations);
}

function metadataScalarsAreValid(
  encrypted: EncryptedLocalLedgerBackupSnapshot,
  encryptedBackupVersion: number
) {
  return [
    encrypted.version === encryptedBackupVersion,
    encrypted.algorithm === "AES-GCM",
    typeof encrypted.ciphertext === "string",
    typeof encrypted.nonce === "string",
  ].every(Boolean);
}

function wrappedDataKeysAreValid(wrappedDataKeys: unknown, wrapIterations: number) {
  return (
    Array.isArray(wrappedDataKeys) &&
    wrappedDataKeys.length > 0 &&
    wrappedDataKeys.every((wrappedDataKey) => isValidWrappedDataKey(wrappedDataKey, wrapIterations))
  );
}

function wrappedDataKeyRecordIsValid(record: Record<string, unknown>, wrapIterations: number) {
  return [
    record.kind === "trusted_device" || record.kind === "recovery_key",
    record.algorithm === "PBKDF2-SHA256+A256GCM",
    isBase64String(record.salt),
    isBase64String(record.nonce),
    isBase64String(record.ciphertext),
    record.iterations === wrapIterations,
  ].every(Boolean);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
