import * as SecureStore from "expo-secure-store";
import type { PrivateBackupHealth, RemoteBackupMetadata } from "@/features/backup/public";
import { derivePrivateBackupHealth } from "@/features/backup/public";
import { captureWarning } from "@/shared/lib";
import { requireBackupId, requireIsoDateTime, requireUserId } from "@/shared/types/assertions";

export type PrivateBackupSettingsState = {
  readonly generatedRecoveryKey: string | null;
  readonly isRecoveryKeyConfirmed: boolean;
  readonly latestBackup: RemoteBackupMetadata | null;
  readonly lastUploadFailedAt: string | null;
  readonly health: PrivateBackupHealth;
};

const PRIVATE_BACKUP_KEY = "private_backup";

const derivePrivateBackupSettingsState = (
  input: Omit<PrivateBackupSettingsState, "health">
): PrivateBackupSettingsState => ({
  ...input,
  health: derivePrivateBackupHealth(toPrivateBackupHealthInput(input)),
});

function toPrivateBackupHealthInput(input: Omit<PrivateBackupSettingsState, "health">) {
  return {
    latestBackup: input.latestBackup,
    hasGeneratedRecoveryKey: input.generatedRecoveryKey !== null,
    isRecoveryKeyConfirmed: input.isRecoveryKeyConfirmed,
    lastUploadFailedAt: input.lastUploadFailedAt,
  };
}

export const DEFAULT_PRIVATE_BACKUP_STATE = derivePrivateBackupSettingsState({
  generatedRecoveryKey: null,
  isRecoveryKeyConfirmed: false,
  latestBackup: null,
  lastUploadFailedAt: null,
});

export const preparePrivateBackupSetup = (
  current: PrivateBackupSettingsState,
  recoveryKey: string
): PrivateBackupSettingsState =>
  derivePrivateBackupSettingsState({
    ...current,
    generatedRecoveryKey: recoveryKey,
    isRecoveryKeyConfirmed: false,
    lastUploadFailedAt: null,
  });

export const markPrivateBackupConfirmed = (
  current: PrivateBackupSettingsState,
  latestBackup: RemoteBackupMetadata
): PrivateBackupSettingsState =>
  derivePrivateBackupSettingsState({
    ...current,
    isRecoveryKeyConfirmed: true,
    latestBackup,
    lastUploadFailedAt: null,
  });

export const markPrivateBackupFailed = (
  current: PrivateBackupSettingsState,
  failedAt: string
): PrivateBackupSettingsState =>
  derivePrivateBackupSettingsState({
    ...current,
    lastUploadFailedAt: failedAt,
  });

export const persistPrivateBackupState = (privateBackup: PrivateBackupSettingsState): void => {
  void SecureStore.setItemAsync(
    PRIVATE_BACKUP_KEY,
    JSON.stringify(toPersistedPrivateBackupState(privateBackup))
  ).catch((error) => {
    captureWarning("private_backup_persist_failed", {
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
  });
};

export const loadPrivateBackupSettingsState = async () =>
  parseStoredPrivateBackupState(await SecureStore.getItemAsync(PRIVATE_BACKUP_KEY));

const toPersistedPrivateBackupState = ({
  health: _health,
  ...privateBackup
}: PrivateBackupSettingsState) => privateBackup;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const requireStringProperty = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }
  return value;
};

const requireNumberProperty = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (typeof value !== "number") {
    throw new Error(`${key} must be a number`);
  }
  return value;
};

const parseStoredRemoteBackupMetadata = (value: unknown): RemoteBackupMetadata | null =>
  value === null ? null : toRemoteBackupMetadata(requireRecord(value, "latestBackup"));

const requireRecord = (value: unknown, key: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`${key} must be an object`);
  }
  return value;
};

const toRemoteBackupMetadata = (value: Record<string, unknown>): RemoteBackupMetadata => ({
  userId: requireUserId(requireStringProperty(value, "userId")),
  backupId: requireBackupId(requireStringProperty(value, "backupId")),
  createdAt: requireIsoDateTime(requireStringProperty(value, "createdAt")),
  schemaVersion: requireNumberProperty(value, "schemaVersion"),
  appVersion: requireStringProperty(value, "appVersion"),
  deviceLabel: requireStringProperty(value, "deviceLabel"),
  ciphertextSizeBytes: requireNumberProperty(value, "ciphertextSizeBytes"),
  ciphertextSha256: requireStringProperty(value, "ciphertextSha256"),
});

const parsePrivateBackupRecord = (value: string | null): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  const raw: unknown = JSON.parse(value);
  return requireRecord(raw, "privateBackup");
};

const parseStoredRecoveryKey = (value: unknown) => {
  if (value === null || typeof value === "string") {
    return value;
  }
  throw new Error("generatedRecoveryKey must be a string or null");
};

const parseStoredRecoveryKeyConfirmed = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error("isRecoveryKeyConfirmed must be a boolean");
};

const parseStoredFailedAt = (value: unknown) => {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("lastUploadFailedAt must be a string or null");
  }

  return requireIsoDateTime(value);
};

const toPrivateBackupSettingsState = (raw: Record<string, unknown>) =>
  derivePrivateBackupSettingsState({
    generatedRecoveryKey: parseStoredRecoveryKey(raw.generatedRecoveryKey),
    isRecoveryKeyConfirmed: parseStoredRecoveryKeyConfirmed(raw.isRecoveryKeyConfirmed),
    latestBackup: parseStoredRemoteBackupMetadata(raw.latestBackup),
    lastUploadFailedAt: parseStoredFailedAt(raw.lastUploadFailedAt),
  });

const parseStoredPrivateBackupState = (value: string | null): PrivateBackupSettingsState | null => {
  const raw = parsePrivateBackupRecord(value);
  return raw === null ? null : toPrivateBackupSettingsState(raw);
};
