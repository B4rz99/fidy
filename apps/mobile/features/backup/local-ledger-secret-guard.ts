import { isBase64String } from "./local-ledger-crypto";

export function containsLocalLedgerBackupSecret(
  value: unknown,
  options: { readonly encryptedBackupVersion: number }
): boolean {
  const context = {
    encryptedBackupVersion: options.encryptedBackupVersion,
    seen: new WeakSet<object>(),
  };
  return containsSecret(value, context);
}

function containsSecret(value: unknown, context: SecretScanContext): boolean {
  return isStringSecret(value) || isBinarySecret(value) || isContainerSecret(value, context);
}

function isStringSecret(value: unknown) {
  return typeof value === "string" && looksLikeRecoveryKey(value);
}

function isBinarySecret(value: unknown) {
  return ArrayBuffer.isView(value);
}

function isContainerSecret(value: unknown, context: SecretScanContext) {
  if (Array.isArray(value)) {
    return unseenObjectContainsSecret(value, context, () =>
      value.some((entry) => containsSecret(entry, context))
    );
  }

  const record = toRecord(value);
  if (record === null) {
    return false;
  }

  return unseenObjectContainsSecret(record, context, () => isRecordSecret(record, context));
}

function isRecordSecret(value: Record<string, unknown>, context: SecretScanContext) {
  if (isPlaintextBackupSnapshot(value)) {
    return true;
  }

  return entriesContainSecret(value, isEncryptedBackupSnapshot(value, context), context);
}

function entriesContainSecret(
  value: Record<string, unknown>,
  encryptedBackupShape: boolean,
  context: SecretScanContext
) {
  return Object.entries(value).some(([key, entry]) => {
    const entryContext = { ...context, encryptedBackupShape };
    return entryContainsSecret(key, entry, entryContext);
  });
}

function entryContainsSecret(
  key: string,
  entry: unknown,
  context: SecretScanContext & { readonly encryptedBackupShape: boolean }
) {
  if (isSafeEncryptedBackupEntry(key, entry, context.encryptedBackupShape)) {
    return false;
  }

  return isSecretKeyName(key) || containsSecret(entry, context);
}

function isSafeEncryptedBackupEntry(key: string, entry: unknown, encryptedBackupShape: boolean) {
  return encryptedBackupShape && encryptedBackupEntryIsWellFormed(key, entry);
}

function looksLikeRecoveryKey(value: string) {
  return /^RK-([0-9A-F]{4}-){5}[0-9A-F]{4}$/u.test(value);
}

function isSecretKeyName(key: string) {
  const normalizedKey = key.toLowerCase();
  return (
    normalizedKey === "plaintext" ||
    SECRET_KEY_NAME_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment))
  );
}

function isPlaintextBackupSnapshot(value: Record<string, unknown>) {
  return (
    value.version === 1 && typeof value.exportedAt === "string" && toRecord(value.data) !== null
  );
}

function isEncryptedBackupSnapshot(value: Record<string, unknown>, context: SecretScanContext) {
  return (
    value.version === context.encryptedBackupVersion &&
    value.algorithm === "AES-GCM" &&
    typeof value.ciphertext === "string" &&
    typeof value.nonce === "string" &&
    Array.isArray(value.wrappedDataKeys)
  );
}

function encryptedBackupEntryIsWellFormed(key: string, entry: unknown) {
  return encryptedBackupFieldValidator(key)(entry);
}

function encryptedBackupFieldValidator(key: string): (entry: unknown) => boolean {
  return ENCRYPTED_BACKUP_FIELD_VALIDATORS[key] ?? alwaysUnsafe;
}

function wrappedDataKeysAreWellFormed(entry: unknown) {
  return Array.isArray(entry) && entry.every(wrappedDataKeyIsWellFormed);
}

function wrappedDataKeyIsWellFormed(entry: unknown) {
  const record = toRecord(entry);
  return record !== null && wrappedDataKeyFieldsAreWellFormed(record);
}

function wrappedDataKeyFieldsAreWellFormed(record: Record<string, unknown>) {
  return (
    Object.keys(record).every((key) => WRAPPED_DATA_KEY_FIELDS.includes(key)) &&
    WRAPPED_DATA_KEY_FIELD_CHECKS.every((check) => check(record))
  );
}

function unseenObjectContainsSecret(
  value: object,
  context: SecretScanContext,
  scan: () => boolean
) {
  if (context.seen.has(value)) {
    return false;
  }

  context.seen.add(value);
  return scan();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

const SECRET_KEY_NAME_FRAGMENTS = [
  "recoverykey",
  "recovery_key",
  "trusteddevicesecret",
  "trusted_device_secret",
  "rawkey",
  "raw_key",
  "derivedkey",
  "derived_key",
] as const;

const alwaysSafe = () => true;
const alwaysUnsafe = () => false;

const ENCRYPTED_BACKUP_FIELD_VALIDATORS: Record<string, (entry: unknown) => boolean> = {
  algorithm: alwaysSafe,
  ciphertext: isBase64String,
  nonce: isBase64String,
  version: alwaysSafe,
  wrappedDataKeys: wrappedDataKeysAreWellFormed,
};

const WRAPPED_DATA_KEY_FIELD_CHECKS = [
  (record: Record<string, unknown>) =>
    record.kind === "trusted_device" || record.kind === "recovery_key",
  (record: Record<string, unknown>) => record.algorithm === "PBKDF2-SHA256+A256GCM",
  (record: Record<string, unknown>) => isBase64String(record.salt),
  (record: Record<string, unknown>) => isBase64String(record.nonce),
  (record: Record<string, unknown>) => isBase64String(record.ciphertext),
  (record: Record<string, unknown>) => typeof record.iterations === "number",
] as const;

const WRAPPED_DATA_KEY_FIELDS: readonly string[] = [
  "kind",
  "algorithm",
  "salt",
  "nonce",
  "ciphertext",
  "iterations",
];

type SecretScanContext = {
  readonly encryptedBackupVersion: number;
  readonly seen: WeakSet<object>;
};
