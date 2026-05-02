type SupabaseError = { readonly message?: string } | null;

type DeleteResponse =
  | Promise<{ readonly error: SupabaseError }>
  | { readonly error: SupabaseError };
type SelectResponse<Row> = Promise<{
  readonly data: readonly Row[] | null;
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
};

const ENCRYPTED_BACKUPS_TABLE = "encrypted_backups";
const ENCRYPTED_BACKUPS_BUCKET = "encrypted-backups";
const BACKUP_DELETE_PAGE_SIZE = 1000;

const OPERATIONAL_REMOTE_TABLES = [
  "push_devices",
  "notification_preferences",
  "notification_parse_improvement_samples",
  "rate_limits",
] as const;

export async function deleteAccountRemoteData(
  supabase: DeleteAccountSupabaseClient,
  userId: string
): Promise<DeleteAccountRemoteResult> {
  const backupBlobFailure = await deleteBackupBlobs(supabase, userId);
  if (backupBlobFailure !== null) {
    return { success: false, failures: [backupBlobFailure] };
  }

  const cleanupFailures = [
    await deleteUserRows(supabase, ENCRYPTED_BACKUPS_TABLE, userId),
    ...(await Promise.all(
      OPERATIONAL_REMOTE_TABLES.map((tableName) => deleteUserRows(supabase, tableName, userId))
    )),
  ].filter((failure): failure is DeleteAccountRemoteFailure => failure !== null);

  if (cleanupFailures.length > 0) {
    return { success: false, failures: cleanupFailures };
  }

  const authFailure = await deleteAuthUser(supabase, userId);
  return {
    success: authFailure === null,
    failures: authFailure === null ? [] : [authFailure],
  };
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

async function deleteUserRows(
  supabase: DeleteAccountSupabaseClient,
  tableName: string,
  userId: string
): Promise<DeleteAccountRemoteFailure | null> {
  const { error } = await supabase.from(tableName).delete().eq("user_id", userId);
  return error === null ? null : { target: tableName, message: error.message ?? "delete_failed" };
}

async function deleteBackupBlobs(
  supabase: DeleteAccountSupabaseClient,
  userId: string
): Promise<DeleteAccountRemoteFailure | null> {
  return deleteBackupBlobPage(supabase, userId, 0);
}

async function deleteBackupBlobPage(
  supabase: DeleteAccountSupabaseClient,
  userId: string,
  pageIndex: number
): Promise<DeleteAccountRemoteFailure | null> {
  const backupRowsResult = await listBackupRows(supabase, userId, pageIndex);
  if ("failure" in backupRowsResult) {
    return backupRowsResult.failure;
  }

  const backupRows = backupRowsResult.rows;
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
    : deleteBackupBlobPage(supabase, userId, pageIndex + 1);
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
