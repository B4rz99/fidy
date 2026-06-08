// biome-ignore-all lint/style/useNamingConvention: Supabase API payloads use snake_case fields

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { EncryptedLocalLedgerBackupSnapshot } from "@/features/backup/public";
import { uploadEncryptedRemoteBackup } from "@/features/backup/public";
import { requireBackupId, requireIsoDateTime, requireUserId } from "@/shared/types/assertions";

const USER_ID = requireUserId("00000000-0000-4000-8000-000000000001");
const BACKUP_ID = requireBackupId("backup-1");
const CREATED_AT = requireIsoDateTime("2026-04-24T10:30:00.000Z");
const AUTHORIZATION_HEADER = "Authorization";

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

type RemoteMetadata = ReturnType<typeof expectedRemoteMetadata>;

describe("remote encrypted backup storage", () => {
  it("uploads encrypted backup blobs with metadata that excludes plaintext and secrets", async () => {
    const supabase = createRemoteBackupSupabase();

    const metadata = await uploadEncryptedRemoteBackup(supabase.client, remoteBackupUploadInput());

    expectUploadCalls(supabase);
    expect(metadata).toMatchObject(expectedRemoteMetadata());
    expectRemotePayloadsToExclude(FORBIDDEN_REMOTE_VALUES, supabase.remotePayloads());
  });

  it("surfaces confirmation failures without direct metadata or blob cleanup", async () => {
    const supabase = createRemoteBackupSupabase({
      apiErrors: { confirmUpload: "metadata_mismatch" },
    });

    await expect(
      uploadEncryptedRemoteBackup(supabase.client, remoteBackupUploadInput())
    ).rejects.toThrow("Unable to call private backup API: metadata_mismatch");
    expect(supabase.fetch).toHaveBeenCalledWith("https://storage.example/upload", {
      body: JSON.stringify(ENCRYPTED_BACKUP),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
    expect(supabase.storageRemove).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.storageFrom).not.toHaveBeenCalled();
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
  expect(supabase.functionsInvoke).toHaveBeenCalledWith("private-backup-api", {
    body: {
      action: "prepareUpload",
      backupId: BACKUP_ID,
    },
    headers: { [AUTHORIZATION_HEADER]: "Bearer backup-access-token" },
  });
  expect(supabase.fetch).toHaveBeenCalledWith("https://storage.example/upload", {
    body: JSON.stringify(ENCRYPTED_BACKUP),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  expect(supabase.storageUploadToSignedUrl).not.toHaveBeenCalled();
  expect(supabase.storageFrom).not.toHaveBeenCalled();
  expect(supabase.functionsInvoke).toHaveBeenCalledWith("private-backup-api", {
    body: {
      action: "confirmUpload",
      ...expectedRemoteMetadata(),
    },
    headers: { [AUTHORIZATION_HEADER]: "Bearer backup-access-token" },
  });
}

function createRemoteBackupSupabase(
  options: {
    readonly apiErrors?: Partial<Record<string, string>>;
    readonly currentBackup?: RemoteMetadata | null;
    readonly storageBody?: string;
  } = {}
) {
  const currentBackup = options.currentBackup === undefined ? null : options.currentBackup;
  const functionsInvoke = vi.fn<(...args: any[]) => any>(
    (functionName: string, invokeOptions: { body: { action: string } }) => {
      expect(functionName).toBe("private-backup-api");
      const action = invokeOptions.body.action;
      const apiError = options.apiErrors?.[action];
      if (apiError !== undefined) {
        return Promise.resolve({ data: { success: false, error: apiError }, error: null });
      }
      if (action === "prepareUpload") {
        return Promise.resolve({
          data: {
            success: true,
            path: `${USER_ID}/${BACKUP_ID}.json`,
            uploadUrl: "https://storage.example/upload",
            uploadToken: "signed-upload-token",
          },
          error: null,
        });
      }
      if (action === "confirmUpload") {
        return Promise.resolve({
          data: { success: true, backup: expectedRemoteMetadata() },
          error: null,
        });
      }
      if (action === "current") {
        return Promise.resolve({
          data: { success: true, backup: currentBackup },
          error: null,
        });
      }
      if (action === "prepareDownload") {
        return Promise.resolve({
          data: {
            success: true,
            backup: currentBackup ?? expectedRemoteMetadata(),
            downloadUrl: "https://storage.example/download",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    }
  );
  const storageUploadToSignedUrl = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({ error: null })
  );
  const storageRemove = vi.fn<(...args: any[]) => any>(() => Promise.resolve({ error: null }));
  const from = vi.fn<(...args: any[]) => any>();
  const fetch = vi.fn<(...args: any[]) => any>(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(JSON.parse(options.storageBody ?? JSON.stringify(ENCRYPTED_BACKUP))),
    })
  );
  vi.stubGlobal("fetch", fetch);
  const bucket = { remove: storageRemove, uploadToSignedUrl: storageUploadToSignedUrl };
  const client = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { access_token: "backup-access-token" } },
          error: null,
        }),
    },
    from,
    functions: { invoke: functionsInvoke },
    storage: {
      from: vi.fn<(...args: any[]) => any>((bucketName: string) => {
        expect(bucketName).toBe("encrypted-backups");
        return bucket;
      }),
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    fetch,
    from,
    functionsInvoke,
    storageRemove,
    storageFrom: client.storage.from,
    storageUploadToSignedUrl,
    remotePayloads: () => [
      functionsInvoke.mock.calls,
      storageUploadToSignedUrl.mock.calls,
      fetch.mock.calls,
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
