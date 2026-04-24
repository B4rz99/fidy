export function containsLocalLedgerBackupSecret(
  value: unknown,
  options: { readonly encryptedBackupVersion: number }
): boolean {
  return (
    isStringSecret(value) ||
    isBinarySecret(value) ||
    isContainerSecret(value, options.encryptedBackupVersion)
  );
}

function isStringSecret(value: unknown) {
  return typeof value === "string" && looksLikeRecoveryKey(value);
}

function isBinarySecret(value: unknown) {
  return ArrayBuffer.isView(value);
}

function isContainerSecret(value: unknown, encryptedBackupVersion: number) {
  if (Array.isArray(value)) {
    return value.some((entry) =>
      containsLocalLedgerBackupSecret(entry, { encryptedBackupVersion })
    );
  }

  const record = toRecord(value);
  if (record === null) {
    return false;
  }

  return isRecordSecret(record, encryptedBackupVersion);
}

function isRecordSecret(value: Record<string, unknown>, encryptedBackupVersion: number) {
  if (isPlaintextBackupSnapshot(value)) {
    return true;
  }

  return entriesContainSecret(
    value,
    isEncryptedBackupSnapshot(value, encryptedBackupVersion),
    encryptedBackupVersion
  );
}

function entriesContainSecret(
  value: Record<string, unknown>,
  encryptedBackupShape: boolean,
  encryptedBackupVersion: number
) {
  const context = { encryptedBackupShape, encryptedBackupVersion };
  return Object.entries(value).some(([key, entry]) => entryContainsSecret(key, entry, context));
}

function entryContainsSecret(
  key: string,
  entry: unknown,
  context: { readonly encryptedBackupShape: boolean; readonly encryptedBackupVersion: number }
) {
  if (isSafeEncryptedBackupEntry(key, context.encryptedBackupShape)) {
    return false;
  }

  return (
    isSecretKeyName(key) ||
    containsLocalLedgerBackupSecret(entry, {
      encryptedBackupVersion: context.encryptedBackupVersion,
    })
  );
}

function isSafeEncryptedBackupEntry(key: string, encryptedBackupShape: boolean) {
  return encryptedBackupShape && isEncryptedBackupField(key);
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

function isEncryptedBackupSnapshot(value: Record<string, unknown>, encryptedBackupVersion: number) {
  return (
    value.version === encryptedBackupVersion &&
    value.algorithm === "AES-GCM" &&
    typeof value.ciphertext === "string" &&
    typeof value.nonce === "string" &&
    Array.isArray(value.wrappedDataKeys)
  );
}

function isEncryptedBackupField(key: string) {
  return ENCRYPTED_BACKUP_FIELDS.includes(key);
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

const ENCRYPTED_BACKUP_FIELDS: readonly string[] = [
  "version",
  "algorithm",
  "ciphertext",
  "nonce",
  "wrappedDataKeys",
];
