// biome-ignore-all lint/style/useNamingConvention: Supabase tables use snake_case fields

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireBackupId, requireIsoDateTime, requireUserId } from "@/shared/types/assertions";
import type { BackupId, IsoDateTime, UserId } from "@/shared/types/branded";
import { fromBase64 } from "./local-ledger-crypto";
import type { EncryptedLocalLedgerBackupSnapshot } from "./local-ledger-encryption";
import { assertLocalLedgerBackupSecretSafeForRemote } from "./local-ledger-encryption";

export const REMOTE_BACKUP_BUCKET = "encrypted-backups";
export const REMOTE_BACKUP_METADATA_TABLE = "encrypted_backups";
const REMOTE_BACKUP_METADATA_COLUMNS =
  "id,user_id,created_at,schema_version,app_version,device_label,ciphertext_size_bytes,ciphertext_sha256";

export type RemoteBackupMetadata = {
  readonly userId: UserId;
  readonly backupId: BackupId;
  readonly createdAt: IsoDateTime;
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly deviceLabel: string;
  readonly ciphertextSizeBytes: number;
  readonly ciphertextSha256: string;
};

export type UploadEncryptedRemoteBackupInput = {
  readonly userId: UserId;
  readonly backupId: BackupId;
  readonly createdAt: IsoDateTime;
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly deviceLabel: string;
  readonly encryptedBackup: EncryptedLocalLedgerBackupSnapshot;
};

export type DownloadEncryptedRemoteBackupInput = {
  readonly userId: UserId;
  readonly backupId: BackupId;
};

export type DeleteEncryptedRemoteBackupInput = DownloadEncryptedRemoteBackupInput;

type RemoteBackupMetadataRow = {
  readonly id: string;
  readonly user_id: string;
  readonly created_at: string;
  readonly schema_version: number;
  readonly app_version: string;
  readonly device_label: string;
  readonly ciphertext_size_bytes: number;
  readonly ciphertext_sha256: string;
};

type RemoteBackupErrorLike = {
  readonly message?: string;
};

export async function uploadEncryptedRemoteBackup(
  supabase: SupabaseClient,
  input: UploadEncryptedRemoteBackupInput
): Promise<RemoteBackupMetadata> {
  assertLocalLedgerBackupSecretSafeForRemote(input.encryptedBackup);
  const storagePath = buildRemoteBackupStoragePath(input.userId, input.backupId);
  const metadata = await buildRemoteBackupMetadata(input);
  const metadataRow = toRemoteBackupMetadataRow(metadata);
  assertLocalLedgerBackupSecretSafeForRemote(metadataRow);

  const uploadResponse = await supabase.storage
    .from(REMOTE_BACKUP_BUCKET)
    .upload(storagePath, JSON.stringify(input.encryptedBackup), {
      contentType: "application/json",
      upsert: true,
    });
  throwIfRemoteBackupError(uploadResponse.error, "upload encrypted backup");

  const metadataResponse = await supabase
    .from(REMOTE_BACKUP_METADATA_TABLE)
    .upsert(metadataRow, { onConflict: "user_id,id" });
  if (metadataResponse.error !== null) {
    await deleteRemoteBackupObject(supabase, storagePath, "roll back encrypted backup object");
  }
  throwIfRemoteBackupError(metadataResponse.error, "save encrypted backup metadata");

  return metadata;
}

export async function listEncryptedRemoteBackups(
  supabase: SupabaseClient,
  userId: UserId
): Promise<readonly RemoteBackupMetadata[]> {
  const response = await supabase
    .from(REMOTE_BACKUP_METADATA_TABLE)
    .select(REMOTE_BACKUP_METADATA_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  throwIfRemoteBackupError(response.error, "list encrypted backup metadata");

  return ((response.data ?? []) as RemoteBackupMetadataRow[]).map(fromRemoteBackupMetadataRow);
}

export async function downloadEncryptedRemoteBackup(
  supabase: SupabaseClient,
  input: DownloadEncryptedRemoteBackupInput
): Promise<EncryptedLocalLedgerBackupSnapshot> {
  const metadata = await getRemoteBackupMetadata(supabase, input);
  const response = await supabase.storage
    .from(REMOTE_BACKUP_BUCKET)
    .download(buildRemoteBackupStoragePath(input.userId, input.backupId));
  throwIfRemoteBackupError(response.error, "download encrypted backup");
  if (response.data === null) {
    throw new Error("Unable to download encrypted backup: missing storage object");
  }

  const encryptedBackup = JSON.parse(
    await response.data.text()
  ) as EncryptedLocalLedgerBackupSnapshot;
  assertLocalLedgerBackupSecretSafeForRemote(encryptedBackup);
  await assertEncryptedBackupMatchesMetadata(encryptedBackup, metadata);
  return encryptedBackup;
}

export async function deleteEncryptedRemoteBackup(
  supabase: SupabaseClient,
  input: DeleteEncryptedRemoteBackupInput
): Promise<void> {
  const metadataResponse = await supabase
    .from(REMOTE_BACKUP_METADATA_TABLE)
    .delete()
    .eq("user_id", input.userId)
    .eq("id", input.backupId);
  throwIfRemoteBackupError(metadataResponse.error, "delete encrypted backup metadata");

  await deleteRemoteBackupObject(
    supabase,
    buildRemoteBackupStoragePath(input.userId, input.backupId),
    "delete encrypted backup object"
  );
}

async function getRemoteBackupMetadata(
  supabase: SupabaseClient,
  input: DownloadEncryptedRemoteBackupInput
): Promise<RemoteBackupMetadata> {
  const response = await supabase
    .from(REMOTE_BACKUP_METADATA_TABLE)
    .select(REMOTE_BACKUP_METADATA_COLUMNS)
    .eq("user_id", input.userId)
    .eq("id", input.backupId)
    .single();
  throwIfRemoteBackupError(response.error, "load encrypted backup metadata");
  if (response.data === null) {
    throw new Error("Unable to load encrypted backup metadata: backup not found");
  }
  return fromRemoteBackupMetadataRow(response.data as RemoteBackupMetadataRow);
}

function buildRemoteBackupStoragePath(userId: UserId, backupId: BackupId) {
  return `${userId}/${backupId}.json`;
}

async function deleteRemoteBackupObject(
  supabase: SupabaseClient,
  storagePath: string,
  operation: string
) {
  const storageResponse = await supabase.storage.from(REMOTE_BACKUP_BUCKET).remove([storagePath]);
  throwIfRemoteBackupError(storageResponse.error, operation);
}

async function buildRemoteBackupMetadata(
  input: UploadEncryptedRemoteBackupInput
): Promise<RemoteBackupMetadata> {
  const ciphertextMetadata = await readCiphertextMetadata(input.encryptedBackup);
  return {
    userId: input.userId,
    backupId: input.backupId,
    createdAt: input.createdAt,
    schemaVersion: input.schemaVersion,
    appVersion: input.appVersion,
    deviceLabel: input.deviceLabel,
    ...ciphertextMetadata,
  };
}

function toRemoteBackupMetadataRow(metadata: RemoteBackupMetadata): RemoteBackupMetadataRow {
  return {
    id: metadata.backupId,
    user_id: metadata.userId,
    created_at: metadata.createdAt,
    schema_version: metadata.schemaVersion,
    app_version: metadata.appVersion,
    device_label: metadata.deviceLabel,
    ciphertext_size_bytes: metadata.ciphertextSizeBytes,
    ciphertext_sha256: metadata.ciphertextSha256,
  };
}

function fromRemoteBackupMetadataRow(row: RemoteBackupMetadataRow): RemoteBackupMetadata {
  return {
    userId: requireUserId(row.user_id),
    backupId: requireBackupId(row.id),
    createdAt: requireIsoDateTime(row.created_at),
    schemaVersion: row.schema_version,
    appVersion: row.app_version,
    deviceLabel: row.device_label,
    ciphertextSizeBytes: row.ciphertext_size_bytes,
    ciphertextSha256: row.ciphertext_sha256,
  };
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readCiphertextMetadata(
  encryptedBackup: EncryptedLocalLedgerBackupSnapshot
): Promise<Pick<RemoteBackupMetadata, "ciphertextSizeBytes" | "ciphertextSha256">> {
  const ciphertext = fromBase64(encryptedBackup.ciphertext);
  return {
    ciphertextSizeBytes: ciphertext.byteLength,
    ciphertextSha256: await sha256Hex(ciphertext),
  };
}

async function assertEncryptedBackupMatchesMetadata(
  encryptedBackup: EncryptedLocalLedgerBackupSnapshot,
  metadata: RemoteBackupMetadata
) {
  const ciphertextMetadata = await readCiphertextMetadata(encryptedBackup);
  if (
    ciphertextMetadata.ciphertextSizeBytes !== metadata.ciphertextSizeBytes ||
    ciphertextMetadata.ciphertextSha256 !== metadata.ciphertextSha256
  ) {
    throw new Error("Downloaded encrypted backup does not match metadata");
  }
}

function throwIfRemoteBackupError(error: RemoteBackupErrorLike | null, operation: string) {
  if (error !== null) {
    throw new Error(`Unable to ${operation}: ${error.message ?? "unknown error"}`);
  }
}
