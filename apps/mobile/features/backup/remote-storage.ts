// biome-ignore-all lint/style/useNamingConvention: Supabase tables use snake_case fields

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BackupId, IsoDateTime, UserId } from "@/shared/types/branded";
import { fromBase64 } from "./local-ledger-crypto";
import type { EncryptedLocalLedgerBackupSnapshot } from "./local-ledger-encryption";
import { assertLocalLedgerBackupSecretSafeForRemote } from "./local-ledger-encryption";

export const REMOTE_BACKUP_BUCKET = "encrypted-backups";
export const REMOTE_BACKUP_METADATA_TABLE = "encrypted_backups";

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

type RemoteBackupErrorLike = {
  readonly message?: string;
};

type PrivateBackupApiResponse<T> =
  | ({ readonly success: true } & T)
  | { readonly success: false; readonly error: string };

type PrepareUploadResponse = PrivateBackupApiResponse<{
  readonly path: string;
  readonly uploadToken: string;
}>;

type ConfirmUploadResponse = PrivateBackupApiResponse<{
  readonly backup: RemoteBackupMetadata;
}>;

type CurrentResponse = PrivateBackupApiResponse<{
  readonly backup: RemoteBackupMetadata | null;
}>;

type PrepareDownloadResponse = PrivateBackupApiResponse<{
  readonly backup: RemoteBackupMetadata;
  readonly downloadUrl: string;
}>;

export async function uploadEncryptedRemoteBackup(
  supabase: SupabaseClient,
  input: UploadEncryptedRemoteBackupInput
): Promise<RemoteBackupMetadata> {
  assertLocalLedgerBackupSecretSafeForRemote(input.encryptedBackup);
  const metadata = await buildRemoteBackupMetadata(input);
  assertLocalLedgerBackupSecretSafeForRemote(metadata);

  const prepared = await invokePrivateBackupApi<PrepareUploadResponse>(supabase, {
    action: "prepareUpload",
    backupId: input.backupId,
  });
  const uploadResponse = await supabase.storage
    .from(REMOTE_BACKUP_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.uploadToken, JSON.stringify(input.encryptedBackup), {
      contentType: "application/json",
    });
  throwIfRemoteBackupError(uploadResponse.error, "upload encrypted backup");

  const confirmed = await invokePrivateBackupApi<ConfirmUploadResponse>(supabase, {
    action: "confirmUpload",
    ...metadata,
  });
  return confirmed.backup;
}

export async function listEncryptedRemoteBackups(
  supabase: SupabaseClient,
  _userId: UserId
): Promise<readonly RemoteBackupMetadata[]> {
  const response = await invokePrivateBackupApi<CurrentResponse>(supabase, { action: "current" });
  return response.backup === null ? [] : [response.backup];
}

export async function downloadEncryptedRemoteBackup(
  supabase: SupabaseClient,
  input: DownloadEncryptedRemoteBackupInput
): Promise<EncryptedLocalLedgerBackupSnapshot> {
  const prepared = await invokePrivateBackupApi<PrepareDownloadResponse>(supabase, {
    action: "prepareDownload",
  });
  if (prepared.backup.backupId !== input.backupId) {
    throw new Error("Unable to download encrypted backup: backup not found");
  }

  const response = await fetch(prepared.downloadUrl);
  if (!response.ok) {
    throw new Error("Unable to download encrypted backup: storage download failed");
  }

  const encryptedBackup = (await response.json()) as EncryptedLocalLedgerBackupSnapshot;
  assertLocalLedgerBackupSecretSafeForRemote(encryptedBackup);
  await assertEncryptedBackupMatchesMetadata(encryptedBackup, prepared.backup);
  return encryptedBackup;
}

export async function deleteEncryptedRemoteBackup(
  supabase: SupabaseClient,
  input: DeleteEncryptedRemoteBackupInput
): Promise<void> {
  const current = await invokePrivateBackupApi<CurrentResponse>(supabase, { action: "current" });
  if (current.backup !== null && current.backup.backupId !== input.backupId) {
    throw new Error("Unable to delete encrypted backup metadata: backup not found");
  }

  await invokePrivateBackupApi<PrivateBackupApiResponse<Record<string, never>>>(supabase, {
    action: "deleteCurrent",
  });
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

async function invokePrivateBackupApi<T extends PrivateBackupApiResponse<unknown>>(
  supabase: SupabaseClient,
  body: Record<string, unknown>
): Promise<Extract<T, { readonly success: true }>> {
  const response = await supabase.functions.invoke<T>("private-backup-api", { body });
  throwIfRemoteBackupError(response.error, "call private backup API");
  if (response.data === null) {
    throw new Error("Unable to call private backup API: missing response");
  }
  if (!response.data.success) {
    throw new Error(`Unable to call private backup API: ${response.data.error}`);
  }
  return response.data as Extract<T, { readonly success: true }>;
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
