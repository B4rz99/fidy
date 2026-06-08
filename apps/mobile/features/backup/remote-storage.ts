// biome-ignore-all lint/style/useNamingConvention: Supabase tables use snake_case fields

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BackupId, IsoDateTime, UserId } from "@/shared/types/branded";
import { fromBase64 } from "./local-ledger-crypto";
import type { EncryptedLocalLedgerBackupSnapshot } from "./local-ledger-encryption";
import { assertLocalLedgerBackupSecretSafeForRemote } from "./local-ledger-encryption";

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

type RemoteBackupErrorLike = {
  readonly message?: string;
};

const AUTHORIZATION_HEADER = "Authorization";

type PrivateBackupApiResponse<T> =
  | ({ readonly success: true } & T)
  | { readonly success: false; readonly error: string };

type PrepareUploadResponse = PrivateBackupApiResponse<{
  readonly path: string;
  readonly uploadUrl: string;
  readonly uploadToken: string;
}>;

type ConfirmUploadResponse = PrivateBackupApiResponse<{
  readonly backup: RemoteBackupMetadata;
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
  const uploadResponse = await fetch(prepared.uploadUrl, {
    body: JSON.stringify(input.encryptedBackup),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  if (!uploadResponse.ok) {
    throw new Error("Unable to upload encrypted backup: storage upload failed");
  }

  const confirmed = await invokePrivateBackupApi<ConfirmUploadResponse>(supabase, {
    action: "confirmUpload",
    ...metadata,
  });
  return confirmed.backup;
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
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;
  const response = await supabase.functions.invoke<T>("private-backup-api", {
    body,
    ...(accessToken ? { headers: { [AUTHORIZATION_HEADER]: `Bearer ${accessToken}` } } : {}),
  });
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

function throwIfRemoteBackupError(error: RemoteBackupErrorLike | null, operation: string) {
  if (error !== null) {
    throw new Error(`Unable to ${operation}: ${error.message ?? "unknown error"}`);
  }
}
