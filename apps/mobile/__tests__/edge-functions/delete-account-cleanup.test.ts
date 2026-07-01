// biome-ignore-all lint/style/useNamingConvention: Supabase table and storage APIs use snake_case
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { deleteAccountRemoteData } from "../../../../supabase/functions/delete-account/cleanup";

const USER_ID = "00000000-0000-4000-8000-000000000001";

describe("delete-account remote cleanup", () => {
  it("deletes Cloud Ledger data, encrypted backups, operational rows, and the auth user", async () => {
    const supabase = createDeleteAccountSupabase({
      backupRows: [{ id: "backup-1" }, { id: "backup-2" }],
    });

    await expect(deleteAccountRemoteData(supabase.client, USER_ID)).resolves.toEqual({
      success: true,
      failures: [],
    });

    expect(supabase.rpc).toHaveBeenCalledWith("cloud_ledger_delete_account_data", {
      p_user_id: USER_ID,
    });
    expect(supabase.tableDeletes()).toEqual([
      "encrypted_backups",
      "push_devices",
      "notification_preferences",
      "capture_improvement_preferences",
      "notification_parse_improvement_samples",
      "rate_limits",
    ]);
    expect(supabase.storageRemove).toHaveBeenCalledWith([
      `${USER_ID}/backup-1.json`,
      `${USER_ID}/backup-2.json`,
    ]);
    expect(supabase.rpc.mock.invocationCallOrder[0]!).toBeLessThan(
      supabase.deleteUser.mock.invocationCallOrder[0]!
    );
    expect(supabase.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("keeps backup metadata and auth retryable after ledger deletion when backup blob removal fails", async () => {
    const supabase = createDeleteAccountSupabase({
      backupRows: [{ id: "backup-1" }],
      storageError: { message: "storage unavailable" },
    });

    await expect(deleteAccountRemoteData(supabase.client, USER_ID)).resolves.toEqual({
      success: false,
      failures: [{ target: "encrypted-backups", message: "storage unavailable" }],
      localCleanupRequired: true,
    });

    expect(supabase.storageRemove).toHaveBeenCalledWith([`${USER_ID}/backup-1.json`]);
    expect(supabase.tableDeletes()).toEqual([
      "push_devices",
      "notification_preferences",
      "capture_improvement_preferences",
      "notification_parse_improvement_samples",
      "rate_limits",
    ]);
    expect(supabase.deleteUser).not.toHaveBeenCalled();
  });

  it("signals local cleanup when operational cleanup fails after ledger deletion", async () => {
    const supabase = createDeleteAccountSupabase({
      backupRows: [],
      tableDeleteErrors: { rate_limits: { message: "rate limit cleanup unavailable" } },
    });

    await expect(deleteAccountRemoteData(supabase.client, USER_ID)).resolves.toEqual({
      success: false,
      failures: [{ target: "rate_limits", message: "rate limit cleanup unavailable" }],
      localCleanupRequired: true,
    });

    expect(supabase.deleteUser).not.toHaveBeenCalled();
  });

  it("signals local cleanup when auth deletion fails after remote data cleanup", async () => {
    const supabase = createDeleteAccountSupabase({
      backupRows: [],
      authDeleteError: { message: "auth cleanup unavailable" },
    });

    await expect(deleteAccountRemoteData(supabase.client, USER_ID)).resolves.toEqual({
      success: false,
      failures: [{ target: "auth.users", message: "auth cleanup unavailable" }],
      localCleanupRequired: true,
    });

    expect(supabase.tableDeletes()).toEqual([
      "encrypted_backups",
      "push_devices",
      "notification_preferences",
      "capture_improvement_preferences",
      "notification_parse_improvement_samples",
      "rate_limits",
    ]);
  });

  it("reports Cloud Ledger cleanup failures before deleting operational rows or the auth user", async () => {
    const supabase = createDeleteAccountSupabase({
      backupRows: [],
      rpcError: { message: "ledger cleanup unavailable" },
    });

    await expect(deleteAccountRemoteData(supabase.client, USER_ID)).resolves.toEqual({
      success: false,
      failures: [{ target: "cloud_ledger", message: "ledger cleanup unavailable" }],
    });

    expect(supabase.tableDeletes()).toEqual([]);
    expect(supabase.deleteUser).not.toHaveBeenCalled();
  });

  it("does not delete backup blobs before Cloud Ledger cleanup succeeds", async () => {
    const supabase = createDeleteAccountSupabase({
      backupRows: [{ id: "backup-1" }],
      rpcError: { message: "ledger cleanup unavailable" },
    });

    await expect(deleteAccountRemoteData(supabase.client, USER_ID)).resolves.toEqual({
      success: false,
      failures: [{ target: "cloud_ledger", message: "ledger cleanup unavailable" }],
    });

    expect(supabase.storageRemove).not.toHaveBeenCalled();
    expect(supabase.tableDeletes()).toEqual([]);
    expect(supabase.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes every backup blob page before removing backup metadata", async () => {
    const backupRows = Array.from({ length: 1001 }, (_, index) => ({ id: `backup-${index}` }));
    const supabase = createDeleteAccountSupabase({ backupRows });

    await expect(deleteAccountRemoteData(supabase.client, USER_ID)).resolves.toEqual({
      success: true,
      failures: [],
    });

    expect(supabase.storageRemove).toHaveBeenNthCalledWith(
      1,
      backupRows.slice(0, 1000).map((row) => `${USER_ID}/${row.id}.json`)
    );
    expect(supabase.storageRemove).toHaveBeenNthCalledWith(2, [`${USER_ID}/backup-1000.json`]);
    expect(supabase.tableDeletes()[0]).toBe("encrypted_backups");
  });

  it("does not expose cleanup target names in the delete-account response", () => {
    const source = readDeleteAccountFunctionSource();

    expect(source).toContain("failureCount: deleteResult.failures.length");
    expect(source).toContain("localCleanupRequired: deleteResult.localCleanupRequired === true");
    expect(source).not.toContain("failures: deleteResult.failures.map");
  });

  it("reports backup metadata list failures before deleting the auth user", async () => {
    const supabase = createDeleteAccountSupabase({
      backupRows: [],
      backupListError: { message: "metadata unavailable" },
    });

    await expect(deleteAccountRemoteData(supabase.client, USER_ID)).resolves.toEqual({
      success: false,
      failures: [{ target: "encrypted_backups", message: "metadata unavailable" }],
    });

    expect(supabase.tableDeletes()).toEqual([]);
    expect(supabase.storageRemove).not.toHaveBeenCalled();
    expect(supabase.deleteUser).not.toHaveBeenCalled();
  });
});

function createDeleteAccountSupabase(options: {
  readonly backupRows: readonly { id: string }[];
  readonly authDeleteError?: { readonly message: string };
  readonly backupListError?: { readonly message: string };
  readonly rpcError?: { readonly message: string };
  readonly storageError?: { readonly message: string };
  readonly tableDeleteErrors?: Readonly<Record<string, { readonly message: string }>>;
}) {
  const tableDeleteCalls: string[] = [];
  const deleteTable = vi.fn<(...args: any[]) => any>((tableName: string) => {
    tableDeleteCalls.push(tableName);
    return {
      eq: vi.fn<(...args: any[]) => any>(() =>
        Promise.resolve({ error: options.tableDeleteErrors?.[tableName] ?? null })
      ),
    };
  });
  const range = vi.fn<(...args: any[]) => any>((from: number, to: number) =>
    Promise.resolve({
      data: options.backupRows.slice(from, to + 1),
      error: options.backupListError ?? null,
    })
  );
  const order = vi.fn<(...args: any[]) => any>(() => ({ range }));
  const selectEq = vi.fn<(...args: any[]) => any>(() => ({ order }));
  const select = vi.fn<(...args: any[]) => any>(() => ({ eq: selectEq }));
  const storageRemove = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({ error: options.storageError ?? null })
  );
  const deleteUser = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({ error: options.authDeleteError ?? null })
  );
  const rpc = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({ data: { code: "deleted" }, error: options.rpcError ?? null })
  );
  const client = {
    auth: { admin: { deleteUser } },
    from: vi.fn<(...args: any[]) => any>((tableName: string) => ({
      delete: () => deleteTable(tableName),
      select,
    })),
    rpc,
    storage: {
      from: vi.fn<(...args: any[]) => any>(() => ({ remove: storageRemove })),
    },
  };

  return {
    client,
    deleteUser,
    rpc,
    storageRemove,
    tableDeletes: () => tableDeleteCalls,
  };
}

function readDeleteAccountFunctionSource() {
  return readFileSync(
    resolve(__dirname, "../../../../supabase/functions/delete-account/index.ts"),
    "utf-8"
  );
}
