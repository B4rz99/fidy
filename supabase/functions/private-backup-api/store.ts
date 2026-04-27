// biome-ignore-all lint/style/useNamingConvention: Supabase tables use snake_case fields
import type { RemoteBackupMetadata, SignedUploadUrl } from "./model.ts";

type SupabaseError = { readonly message?: string } | null;

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

type SupabaseLike = {
  from(tableName: string): {
    select(columns: string): {
      eq(column: string, value: string): unknown;
    };
    upsert(
      row: RemoteBackupMetadataRow,
      options: { readonly onConflict: string }
    ): Promise<{ readonly error: SupabaseError }>;
    delete(): {
      eq(
        column: string,
        value: string
      ): {
        eq(column: string, value: string): Promise<{ readonly error: SupabaseError }>;
      };
    };
  };
  readonly storage: {
    from(bucketName: string): {
      createSignedUploadUrl(path: string): Promise<{
        readonly data: { readonly signedUrl: string; readonly token?: string } | null;
        readonly error: SupabaseError;
      }>;
      createSignedUrl(
        path: string,
        expiresIn: number
      ): Promise<{
        readonly data: { readonly signedUrl: string } | null;
        readonly error: SupabaseError;
      }>;
      download(path: string): Promise<{
        readonly data: { arrayBuffer(): Promise<ArrayBuffer> } | null;
        readonly error: SupabaseError;
      }>;
      remove(paths: readonly string[]): Promise<{ readonly error: SupabaseError }>;
    };
  };
};

const BACKUP_TABLE = "encrypted_backups";
const BACKUP_BUCKET = "encrypted-backups";
const BACKUP_COLUMNS =
  "id,user_id,created_at,schema_version,app_version,device_label,ciphertext_size_bytes,ciphertext_sha256";
const SIGNED_URL_EXPIRES_IN_SECONDS = 300;

export function createPrivateBackupStore(supabase: SupabaseLike) {
  return {
    loadBackup: (userId: string, backupId: string) => loadBackup(supabase, userId, backupId),
    listBackups: (userId: string) => listBackups(supabase, userId),
    loadCurrentBackup: (userId: string) => loadCurrentBackup(supabase, userId),
    createSignedUploadUrl: (path: string) => createSignedUploadUrl(supabase, path),
    createSignedDownloadUrl: (path: string) => createSignedDownloadUrl(supabase, path),
    downloadObject: (path: string) => downloadObject(supabase, path),
    confirmBackup: (metadata: RemoteBackupMetadata) => confirmBackup(supabase, metadata),
    deleteBackupMetadata: (userId: string, backupId: string) =>
      deleteBackupMetadata(supabase, userId, backupId),
    deleteObject: (path: string) => deleteObject(supabase, path),
  };
}

async function loadBackup(
  supabase: SupabaseLike,
  userId: string,
  backupId: string
): Promise<RemoteBackupMetadata | null> {
  const query = supabase.from(BACKUP_TABLE).select(BACKUP_COLUMNS).eq("user_id", userId);
  const response = await eqSingle(query, "id", backupId);
  throwIfError(response.error, "load encrypted backup metadata");
  return response.data === null ? null : fromRow(response.data);
}

async function loadCurrentBackup(
  supabase: SupabaseLike,
  userId: string
): Promise<RemoteBackupMetadata | null> {
  const query = supabase.from(BACKUP_TABLE).select(BACKUP_COLUMNS).eq("user_id", userId);
  const response = await orderLimitSingle(query, "created_at", false, 1);
  throwIfError(response.error, "load current encrypted backup metadata");
  return response.data === null ? null : fromRow(response.data);
}

async function listBackups(
  supabase: SupabaseLike,
  userId: string
): Promise<readonly RemoteBackupMetadata[]> {
  const query = supabase.from(BACKUP_TABLE).select(BACKUP_COLUMNS).eq("user_id", userId);
  const response = await orderMany(query, "created_at", false);
  throwIfError(response.error, "list encrypted backup metadata");
  return (response.data ?? []).map(fromRow);
}

async function createSignedUploadUrl(
  supabase: SupabaseLike,
  path: string
): Promise<SignedUploadUrl> {
  const { data, error } = await supabase.storage.from(BACKUP_BUCKET).createSignedUploadUrl(path);
  throwIfError(error, "create signed encrypted backup upload URL");
  if (data === null) {
    throw new Error("Unable to create signed encrypted backup upload URL: missing URL");
  }
  if (typeof data.token !== "string" || data.token.length === 0) {
    throw new Error("Unable to create signed encrypted backup upload URL: missing token");
  }
  return {
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

async function createSignedDownloadUrl(supabase: SupabaseLike, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS);
  throwIfError(error, "create signed encrypted backup download URL");
  if (data === null) {
    throw new Error("Unable to create signed encrypted backup download URL: missing URL");
  }
  return data.signedUrl;
}

async function downloadObject(supabase: SupabaseLike, path: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(BACKUP_BUCKET).download(path);
  throwIfError(error, "download encrypted backup object");
  return data === null ? null : new Uint8Array(await data.arrayBuffer());
}

async function confirmBackup(
  supabase: SupabaseLike,
  metadata: RemoteBackupMetadata
): Promise<void> {
  const { error } = await supabase.from(BACKUP_TABLE).upsert(toRow(metadata), {
    onConflict: "user_id,id",
  });
  throwIfError(error, "confirm encrypted backup metadata");
}

async function deleteBackupMetadata(
  supabase: SupabaseLike,
  userId: string,
  backupId: string
): Promise<void> {
  const { error } = await supabase
    .from(BACKUP_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("id", backupId);
  throwIfError(error, "delete encrypted backup metadata");
}

async function deleteObject(supabase: SupabaseLike, path: string): Promise<void> {
  const { error } = await supabase.storage.from(BACKUP_BUCKET).remove([path]);
  throwIfError(error, "delete encrypted backup object");
}

function fromRow(row: RemoteBackupMetadataRow): RemoteBackupMetadata {
  return {
    userId: row.user_id,
    backupId: row.id,
    createdAt: row.created_at,
    schemaVersion: row.schema_version,
    appVersion: row.app_version,
    deviceLabel: row.device_label,
    ciphertextSizeBytes: row.ciphertext_size_bytes,
    ciphertextSha256: row.ciphertext_sha256,
  };
}

function toRow(metadata: RemoteBackupMetadata): RemoteBackupMetadataRow {
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

async function eqSingle(
  query: unknown,
  column: string,
  value: string
): Promise<{ readonly data: RemoteBackupMetadataRow | null; readonly error: SupabaseError }> {
  return await (
    query as {
      eq(
        column: string,
        value: string
      ): {
        maybeSingle(): Promise<{
          readonly data: RemoteBackupMetadataRow | null;
          readonly error: SupabaseError;
        }>;
      };
    }
  )
    .eq(column, value)
    .maybeSingle();
}

async function orderLimitSingle(
  query: unknown,
  column: string,
  ascending: boolean,
  count: number
): Promise<{ readonly data: RemoteBackupMetadataRow | null; readonly error: SupabaseError }> {
  return await (
    query as {
      order(
        column: string,
        options: { readonly ascending: boolean }
      ): {
        limit(count: number): {
          maybeSingle(): Promise<{
            readonly data: RemoteBackupMetadataRow | null;
            readonly error: SupabaseError;
          }>;
        };
      };
    }
  )
    .order(column, { ascending })
    .limit(count)
    .maybeSingle();
}

async function orderMany(
  query: unknown,
  column: string,
  ascending: boolean
): Promise<{
  readonly data: readonly RemoteBackupMetadataRow[] | null;
  readonly error: SupabaseError;
}> {
  return await (
    query as {
      order(
        column: string,
        options: { readonly ascending: boolean }
      ): Promise<{
        readonly data: readonly RemoteBackupMetadataRow[] | null;
        readonly error: SupabaseError;
      }>;
    }
  ).order(column, { ascending });
}

function throwIfError(error: SupabaseError, operation: string) {
  if (error !== null) {
    throw new Error(`Unable to ${operation}: ${error.message ?? "unknown error"}`);
  }
}
