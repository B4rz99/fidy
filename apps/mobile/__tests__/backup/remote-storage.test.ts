// biome-ignore-all lint/style/useNamingConvention: Supabase API payloads use snake_case fields

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { EncryptedLocalLedgerBackupSnapshot } from "@/features/backup/public";
import {
  deleteEncryptedRemoteBackup,
  downloadEncryptedRemoteBackup,
  listEncryptedRemoteBackups,
  uploadEncryptedRemoteBackup,
} from "@/features/backup/public";
import { requireBackupId, requireIsoDateTime, requireUserId } from "@/shared/types/assertions";

const USER_ID = requireUserId("00000000-0000-4000-8000-000000000001");
const BACKUP_ID = requireBackupId("backup-1");
const CREATED_AT = requireIsoDateTime("2026-04-24T10:30:00.000Z");

const ENCRYPTED_BACKUP = {
  version: 1,
  algorithm: "AES-GCM",
  ciphertext: "Y2lwaGVydGV4dA==",
  nonce: "bm9uY2U=",
  wrappedDataKeys: [
    {
      kind: "recovery_key",
      algorithm: "PBKDF2-SHA256+A256GCM",
      salt: "c2FsdA==",
      nonce: "d3JhcC1ub25jZQ==",
      ciphertext: "d3JhcHBlZC1kYXRhLWtleQ==",
      iterations: 210_000,
    },
  ],
} satisfies EncryptedLocalLedgerBackupSnapshot;

const FORBIDDEN_REMOTE_VALUES = [
  "Lunch",
  "txn-1",
  "raw-key-material",
  "RK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF",
  "trusted-device-secret",
] as const;

type RemoteMetadataRow = {
  readonly id: string;
  readonly user_id: string;
  readonly created_at: string;
  readonly schema_version: number;
  readonly app_version: string;
  readonly device_label: string;
  readonly ciphertext_size_bytes: number;
  readonly ciphertext_sha256: string;
};

describe("remote encrypted backup storage", () => {
  it("uploads encrypted backup blobs with metadata that excludes plaintext and secrets", async () => {
    const supabase = createRemoteBackupSupabase();

    const metadata = await uploadEncryptedRemoteBackup(supabase.client, remoteBackupUploadInput());

    expectUploadCalls(supabase);
    expect(metadata).toMatchObject(expectedRemoteMetadata());
    expectRemotePayloadsToExclude(FORBIDDEN_REMOTE_VALUES, supabase.remotePayloads());
  });

  it("removes an uploaded blob when metadata persistence fails", async () => {
    const supabase = createRemoteBackupSupabase({
      metadataUpsertError: { message: "metadata write failed" },
    });

    await expect(
      uploadEncryptedRemoteBackup(supabase.client, remoteBackupUploadInput())
    ).rejects.toThrow("Unable to save encrypted backup metadata: metadata write failed");
    expect(supabase.storageUpload).toHaveBeenCalledWith(
      `${USER_ID}/${BACKUP_ID}.json`,
      JSON.stringify(ENCRYPTED_BACKUP),
      { contentType: "application/json", upsert: true }
    );
    expect(supabase.storageRemove).toHaveBeenCalledWith([`${USER_ID}/${BACKUP_ID}.json`]);
  });

  it("lists only encrypted backup metadata for the current user", async () => {
    const supabase = createRemoteBackupSupabase({ metadataRows: [remoteMetadataRow()] });

    await expect(listEncryptedRemoteBackups(supabase.client, USER_ID)).resolves.toEqual([
      expectedRemoteMetadata(),
    ]);
    expect(supabase.metadataEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabase.metadataOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(supabase.storageUpload).not.toHaveBeenCalled();
  });

  it("downloads an encrypted backup blob through user-scoped metadata", async () => {
    const supabase = createRemoteBackupSupabase({
      metadataRows: [remoteMetadataRow()],
      storageBody: JSON.stringify(ENCRYPTED_BACKUP),
    });

    await expect(
      downloadEncryptedRemoteBackup(supabase.client, {
        userId: USER_ID,
        backupId: BACKUP_ID,
      })
    ).resolves.toEqual(ENCRYPTED_BACKUP);
    expect(supabase.metadataEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabase.metadataEq).toHaveBeenCalledWith("id", BACKUP_ID);
    expect(supabase.storageDownload).toHaveBeenCalledWith(`${USER_ID}/${BACKUP_ID}.json`);
    expectRemotePayloadsToExclude(FORBIDDEN_REMOTE_VALUES, supabase.remotePayloads());
  });

  it("rejects a downloaded blob that does not match its metadata", async () => {
    const supabase = createRemoteBackupSupabase({
      metadataRows: [remoteMetadataRow()],
      storageBody: JSON.stringify({ ...ENCRYPTED_BACKUP, ciphertext: "c3RhbGU=" }),
    });

    await expect(
      downloadEncryptedRemoteBackup(supabase.client, {
        userId: USER_ID,
        backupId: BACKUP_ID,
      })
    ).rejects.toThrow("Downloaded encrypted backup does not match metadata");
  });

  it("deletes the encrypted backup blob and user-scoped metadata row", async () => {
    const supabase = createRemoteBackupSupabase();

    await expect(
      deleteEncryptedRemoteBackup(supabase.client, {
        userId: USER_ID,
        backupId: BACKUP_ID,
      })
    ).resolves.toBeUndefined();
    expect(supabase.storageRemove).toHaveBeenCalledWith([`${USER_ID}/${BACKUP_ID}.json`]);
    expect(supabase.metadataDelete).toHaveBeenCalled();
    expect(supabase.metadataDeleteEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabase.metadataDeleteEq).toHaveBeenCalledWith("id", BACKUP_ID);
  });

  it("keeps the blob when metadata deletion fails", async () => {
    const supabase = createRemoteBackupSupabase({
      metadataDeleteError: { message: "metadata delete failed" },
    });

    await expect(
      deleteEncryptedRemoteBackup(supabase.client, {
        userId: USER_ID,
        backupId: BACKUP_ID,
      })
    ).rejects.toThrow("Unable to delete encrypted backup metadata: metadata delete failed");
    expect(supabase.metadataDelete).toHaveBeenCalled();
    expect(supabase.storageRemove).not.toHaveBeenCalled();
  });
});

function remoteBackupUploadInput() {
  return {
    userId: USER_ID,
    backupId: BACKUP_ID,
    createdAt: CREATED_AT,
    schemaVersion: 1,
    appVersion: "1.2.3",
    deviceLabel: "iPhone 17",
    encryptedBackup: ENCRYPTED_BACKUP,
  };
}

function expectedRemoteMetadata() {
  return {
    backupId: BACKUP_ID,
    userId: USER_ID,
    createdAt: CREATED_AT,
    schemaVersion: 1,
    appVersion: "1.2.3",
    deviceLabel: "iPhone 17",
    ciphertextSizeBytes: 10,
    ciphertextSha256: "305531dcc50ebca31cf1d5b31e9fc76ed51f66b3b6dd5a030c6539ae6532f979",
  };
}

function expectUploadCalls(supabase: ReturnType<typeof createRemoteBackupSupabase>) {
  expect(supabase.storageUpload).toHaveBeenCalledWith(
    `${USER_ID}/${BACKUP_ID}.json`,
    JSON.stringify(ENCRYPTED_BACKUP),
    { contentType: "application/json", upsert: true }
  );
  expect(supabase.metadataUpsert).toHaveBeenCalledWith(remoteMetadataRow(), {
    onConflict: "user_id,id",
  });
}

function remoteMetadataRow(): RemoteMetadataRow {
  return {
    id: BACKUP_ID,
    user_id: USER_ID,
    created_at: CREATED_AT,
    schema_version: 1,
    app_version: "1.2.3",
    device_label: "iPhone 17",
    ciphertext_size_bytes: 10,
    ciphertext_sha256: "305531dcc50ebca31cf1d5b31e9fc76ed51f66b3b6dd5a030c6539ae6532f979",
  };
}

function createRemoteBackupSupabase(
  options: {
    readonly metadataRows?: readonly RemoteMetadataRow[];
    readonly metadataDeleteError?: { readonly message: string };
    readonly metadataUpsertError?: { readonly message: string };
    readonly storageBody?: string;
  } = {}
) {
  const metadataOrder = vi.fn(() =>
    Promise.resolve({ data: options.metadataRows ?? [], error: null })
  );
  const metadataSingle = vi.fn(() =>
    Promise.resolve({ data: options.metadataRows?.[0] ?? null, error: null })
  );
  const metadataEq = vi.fn(() => ({
    eq: metadataEq,
    error: null,
    order: metadataOrder,
    single: metadataSingle,
  }));
  const metadataDeleteEq = vi.fn(() => ({
    eq: metadataDeleteEq,
    error: options.metadataDeleteError ?? null,
  }));
  const metadataSelect = vi.fn(() => ({ eq: metadataEq }));
  const metadataDelete = vi.fn(() => ({
    eq: metadataDeleteEq,
    error: options.metadataDeleteError ?? null,
  }));
  const metadataUpsert = vi.fn(() =>
    Promise.resolve({ error: options.metadataUpsertError ?? null })
  );
  const storageUpload = vi.fn(() => Promise.resolve({ error: null }));
  const storageDownload = vi.fn(() =>
    Promise.resolve({
      data: { text: () => Promise.resolve(options.storageBody ?? "") },
      error: null,
    })
  );
  const storageRemove = vi.fn(() => Promise.resolve({ error: null }));
  const table = { delete: metadataDelete, select: metadataSelect, upsert: metadataUpsert };
  const bucket = { download: storageDownload, remove: storageRemove, upload: storageUpload };
  const client = {
    from: vi.fn((tableName: string) => {
      expect(tableName).toBe("encrypted_backups");
      return table;
    }),
    storage: {
      from: vi.fn((bucketName: string) => {
        expect(bucketName).toBe("encrypted-backups");
        return bucket;
      }),
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    metadataEq,
    metadataOrder,
    metadataSelect,
    metadataSingle,
    metadataDelete,
    metadataDeleteEq,
    metadataUpsert,
    storageDownload,
    storageRemove,
    storageUpload,
    remotePayloads: () => [
      metadataEq.mock.calls,
      metadataUpsert.mock.calls,
      storageDownload.mock.calls,
      storageUpload.mock.calls,
    ],
  };
}

function expectRemotePayloadsToExclude(
  forbiddenValues: readonly string[],
  remotePayloads: readonly unknown[]
) {
  const serialized = JSON.stringify(remotePayloads);
  forbiddenValues.forEach((value) => {
    expect(serialized).not.toContain(value);
  });
}
