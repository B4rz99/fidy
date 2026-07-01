import type { SupabaseError } from "../_shared/supabase-error.ts";

type DeleteResponse =
  | Promise<{ readonly error: SupabaseError }>
  | { readonly error: SupabaseError };
type SelectResponse<Row> = Promise<{
  readonly data: readonly Row[] | null;
  readonly error: SupabaseError;
}>;
type RpcResponse = Promise<{
  readonly data: { readonly code?: string } | null;
  readonly error: SupabaseError;
}>;

type DeleteQuery = {
  eq(column: string, value: string): DeleteResponse;
};

type SelectQuery<Row> = {
  eq(column: string, value: string): OrderedSelectQuery<Row>;
};

type OrderedSelectQuery<Row> = {
  order(column: string, options: { readonly ascending: boolean }): RangedSelectQuery<Row>;
};

type RangedSelectQuery<Row> = {
  range(from: number, to: number): SelectResponse<Row>;
};

type BackupRow = {
  readonly id: string;
};

export type DeleteAccountSupabaseClient = {
  readonly auth: {
    readonly admin: {
      deleteUser(userId: string): DeleteResponse;
    };
  };
  from(tableName: string): {
    delete(): DeleteQuery;
    select(columns: string): SelectQuery<{ readonly id: string }>;
  };
  rpc(functionName: string, params: Record<string, unknown>): RpcResponse;
  readonly storage: {
    from(bucketName: string): {
      remove(paths: readonly string[]): DeleteResponse;
    };
  };
};

export type DeleteAccountRemoteFailure = {
  readonly target: string;
  readonly message: string;
};

export type DeleteAccountRemoteResult = {
  readonly success: boolean;
  readonly failures: readonly DeleteAccountRemoteFailure[];
  readonly localCleanupRequired?: boolean;
};

const ENCRYPTED_BACKUPS_TABLE = "encrypted_backups";
const ENCRYPTED_BACKUPS_BUCKET = "encrypted-backups";
const BACKUP_DELETE_PAGE_SIZE = 1000;

const OPERATIONAL_REMOTE_TABLES = [
  "push_devices",
  "notification_preferences",
  "capture_improvement_preferences",
  "notification_parse_improvement_samples",
  "rate_limits",
] as const;

export async function deleteAccountRemoteData(
  supabase: DeleteAccountSupabaseClient,
  userId: string
): Promise<DeleteAccountRemoteResult> {
  const backupRowsResult = await listAllBackupRows(supabase, userId);
  if ("failure" in backupRowsResult) {
    return { success: false, failures: [backupRowsResult.failure] };
  }

  const cloudLedgerFailure = await deleteCloudLedgerAccountData(supabase, userId);
  if (cloudLedgerFailure !== null) {
    return { success: false, failures: [cloudLedgerFailure] };
  }

  const cleanupFailures = [
    await deleteRetryableBackupData(supabase, userId, backupRowsResult.rows),
    ...(await Promise.all(
      OPERATIONAL_REMOTE_TABLES.map((tableName) => deleteUserRows(supabase, tableName, userId))
    )),
  ].filter((failure): failure is DeleteAccountRemoteFailure => failure !== null);

  if (cleanupFailures.length > 0) {
    return {
      success: false,
      failures: cleanupFailures,
      localCleanupRequired: true,
    };
  }

  const authFailure = await deleteAuthUser(supabase, userId);
  if (authFailure !== null) {
    return {
      success: false,
      failures: [...cleanupFailures, authFailure],
      localCleanupRequired: true,
    };
  }

  return {
    success: true,
    failures: [],
  };
}

async function deleteCloudLedgerAccountData(
  supabase: DeleteAccountSupabaseClient,
  userId: string
): Promise<DeleteAccountRemoteFailure | null> {
  const { data, error } = await supabase.rpc("cloud_ledger_delete_account_data", {
    p_user_id: userId,
  });
  if (error !== null) {
    return { target: "cloud_ledger", message: error.message ?? "delete_failed" };
  }
  return data?.code === "deleted"
    ? null
    : { target: "cloud_ledger", message: data?.code ?? "delete_failed" };
}

async function listBackupRows(
  supabase: DeleteAccountSupabaseClient,
  userId: string,
  pageIndex: number
): Promise<
  | { readonly rows: readonly { readonly id: string }[] }
  | { readonly failure: DeleteAccountRemoteFailure }
> {
  const pageStart = pageIndex * BACKUP_DELETE_PAGE_SIZE;
  const pageEnd = pageStart + BACKUP_DELETE_PAGE_SIZE - 1;
  const { data, error } = await supabase
    .from(ENCRYPTED_BACKUPS_TABLE)
    .select("id")
    .eq("user_id", userId)
    .order("id", { ascending: true })
    .range(pageStart, pageEnd);

  if (error != null) {
    return {
      failure: {
        target: ENCRYPTED_BACKUPS_TABLE,
        message: error.message ?? "Unable to list encrypted backups",
      },
    };
  }

  return { rows: data ?? [] };
}

async function listAllBackupRows(
  supabase: DeleteAccountSupabaseClient,
  userId: string,
  pageIndex = 0,
  rows: readonly BackupRow[] = []
): Promise<
  { readonly rows: readonly BackupRow[] } | { readonly failure: DeleteAccountRemoteFailure }
> {
  const pageResult = await listBackupRows(supabase, userId, pageIndex);
  if ("failure" in pageResult) {
    return pageResult;
  }

  const nextRows = [...rows, ...pageResult.rows];
  return pageResult.rows.length < BACKUP_DELETE_PAGE_SIZE
    ? { rows: nextRows }
    : listAllBackupRows(supabase, userId, pageIndex + 1, nextRows);
}

async function deleteUserRows(
  supabase: DeleteAccountSupabaseClient,
  tableName: string,
  userId: string
): Promise<DeleteAccountRemoteFailure | null> {
  const { error } = await supabase.from(tableName).delete().eq("user_id", userId);
  return error === null ? null : { target: tableName, message: error.message ?? "delete_failed" };
}

async function deleteRetryableBackupData(
  supabase: DeleteAccountSupabaseClient,
  userId: string,
  backupRows: readonly BackupRow[]
): Promise<DeleteAccountRemoteFailure | null> {
  const backupBlobFailure = await deleteBackupBlobs(supabase, userId, backupRows);
  return backupBlobFailure ?? (await deleteUserRows(supabase, ENCRYPTED_BACKUPS_TABLE, userId));
}

async function deleteBackupBlobs(
  supabase: DeleteAccountSupabaseClient,
  userId: string,
  backupRows: readonly BackupRow[]
): Promise<DeleteAccountRemoteFailure | null> {
  return deleteBackupBlobPage(supabase, userId, backupRows, 0);
}

async function deleteBackupBlobPage(
  supabase: DeleteAccountSupabaseClient,
  userId: string,
  rows: readonly BackupRow[],
  pageIndex: number
): Promise<DeleteAccountRemoteFailure | null> {
  const pageStart = pageIndex * BACKUP_DELETE_PAGE_SIZE;
  const backupRows = rows.slice(pageStart, pageStart + BACKUP_DELETE_PAGE_SIZE);
  if (backupRows.length === 0) {
    return null;
  }

  const paths = backupRows.map((row) => `${userId}/${row.id}.json`);
  const { error } = await supabase.storage.from(ENCRYPTED_BACKUPS_BUCKET).remove(paths);
  if (error !== null) {
    return { target: ENCRYPTED_BACKUPS_BUCKET, message: error.message ?? "delete_failed" };
  }

  return backupRows.length < BACKUP_DELETE_PAGE_SIZE
    ? null
    : deleteBackupBlobPage(supabase, userId, rows, pageIndex + 1);
}

async function deleteAuthUser(
  supabase: DeleteAccountSupabaseClient,
  userId: string
): Promise<DeleteAccountRemoteFailure | null> {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  return error === null
    ? null
    : { target: "auth.users", message: error.message ?? "delete_failed" };
}
