// biome-ignore-all lint/style/useNamingConvention: Supabase table and storage APIs use snake_case
import { describe, expect, it, vi } from "vitest";
import { handlePrivateBackupRequest } from "../../../../supabase/functions/private-backup-api/handler";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const BACKUP_ID = "backup-1";
const CREATED_AT = "2026-04-26T10:00:00.000Z";
const CIPHERTEXT = new TextEncoder().encode("ciphertext");
const ENCRYPTED_BACKUP_OBJECT = new TextEncoder().encode(
  JSON.stringify({
    version: 1,
    algorithm: "AES-GCM",
    nonce: "bm9uY2U=",
    ciphertext: "Y2lwaGVydGV4dA==",
    wrappedDataKeys: [],
  })
);
const SHA256 = "305531dcc50ebca31cf1d5b31e9fc76ed51f66b3b6dd5a030c6539ae6532f979";

describe("private-backup-api Edge Function", () => {
  it("rejects missing and invalid auth before backup actions run", async () => {
    const missingAuth = createPrivateBackupApiDeps();
    const missingAuthResponse = await handlePrivateBackupRequest(
      jsonRequest({ action: "current" }),
      missingAuth.deps
    );

    expect(missingAuthResponse.status).toBe(401);
    await expect(missingAuthResponse.json()).resolves.toEqual({
      success: false,
      error: "missing_auth",
    });
    expectNoStoreCalls(missingAuth.store);

    const invalidAuth = createPrivateBackupApiDeps({ authError: { message: "bad token" } });
    const invalidAuthResponse = await handlePrivateBackupRequest(
      jsonRequest({ action: "current" }, "invalid-token"),
      invalidAuth.deps
    );

    expect(invalidAuthResponse.status).toBe(401);
    await expect(invalidAuthResponse.json()).resolves.toEqual({
      success: false,
      error: "invalid_auth",
    });
    expectNoStoreCalls(invalidAuth.store);
  });

  it("rate limits authenticated backup API requests before actions run", async () => {
    const api = createPrivateBackupApiDeps({
      rateLimit: { allowed: false, retryAfterSeconds: 41 },
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "current" }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("41");
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "rate_limited",
    });
    expect(api.rateLimit).toHaveBeenCalledWith(USER_ID);
    expectNoStoreCalls(api.store);
  });

  it("fails closed when rate limiting is unavailable", async () => {
    const api = createPrivateBackupApiDeps({
      rateLimitError: new Error("rate limit unavailable"),
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "current" }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "rate_limit_unavailable",
    });
    expectNoStoreCalls(api.store);
  });

  it("routes only the private backup actions", async () => {
    const api = createPrivateBackupApiDeps();

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "listAll" }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "unsupported_action",
    });
  });

  it("prepares signed upload URLs only for authenticated user backup paths", async () => {
    const api = createPrivateBackupApiDeps({ userId: USER_ID });

    const response = await handlePrivateBackupRequest(
      jsonRequest(
        {
          action: "prepareUpload",
          userId: OTHER_USER_ID,
          backupId: ` ${BACKUP_ID} `,
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      uploadUrl: "https://storage.example/upload",
      uploadToken: "signed-upload-token",
      path: `${USER_ID}/${BACKUP_ID}.json`,
      expiresInSeconds: 300,
    });
    expect(api.store.createdUploadUrls()).toEqual([`${USER_ID}/${BACKUP_ID}.json`]);
    expect(api.store.uploadUrlOptions()).toEqual([undefined]);
  });

  it("rejects prepareUpload when the backup id is already confirmed", async () => {
    const api = createPrivateBackupApiDeps({
      backups: [metadataRow({ backupId: BACKUP_ID })],
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "prepareUpload", backupId: BACKUP_ID }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "backup_already_confirmed",
    });
    expect(api.store.createdUploadUrls()).toEqual([]);
  });

  it("rejects path-breaking backup ids before creating signed upload URLs", async () => {
    const api = createPrivateBackupApiDeps();

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "prepareUpload", backupId: "../backup-1" }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_metadata",
    });
    expect(api.store.loadBackup).not.toHaveBeenCalled();
    expect(api.store.createdUploadUrls()).toEqual([]);
  });

  it("returns the current authenticated-user backup metadata", async () => {
    const current = metadataRow({ backupId: BACKUP_ID });
    const api = createPrivateBackupApiDeps({
      backups: [
        metadataRow({
          userId: OTHER_USER_ID,
          backupId: "backup-other-user",
          createdAt: "2026-04-27T10:00:00.000Z",
        }),
        current,
      ],
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "current" }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      backup: current,
    });
    expect(api.store.loadCurrentBackup).toHaveBeenCalledWith(USER_ID);
    expect(api.store.listBackups).not.toHaveBeenCalled();
  });

  it("does not expose backup history while the API contract is current-backup only", async () => {
    const current = metadataRow({
      backupId: "backup-current",
      createdAt: "2026-04-27T10:00:00.000Z",
    });
    const legacy = metadataRow({
      backupId: "backup-legacy",
      createdAt: "2026-04-26T10:00:00.000Z",
    });
    const api = createPrivateBackupApiDeps({ backups: [legacy, current] });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "current" }, "valid-token"),
      api.deps
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      backup: current,
    });
    expect(JSON.stringify(body)).not.toContain("backup-legacy");
  });

  it("confirms uploaded metadata only after server-side object verification", async () => {
    const api = createPrivateBackupApiDeps({
      objects: new Map([[`${USER_ID}/${BACKUP_ID}.json`, ENCRYPTED_BACKUP_OBJECT]]),
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "confirmUpload", ...metadataPayload() }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      backup: metadataRow({ backupId: BACKUP_ID }),
    });
    expect(api.store.confirmedBackups()).toEqual([metadataRow({ backupId: BACKUP_ID })]);
    expect(api.store.deletedObjects()).toEqual([]);
  });

  it("reports storage download failures as server errors during confirmation", async () => {
    const api = createPrivateBackupApiDeps({
      downloadObjectError: new Error("storage unavailable"),
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "confirmUpload", ...metadataPayload() }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "internal_error",
    });
    expect(api.store.confirmedBackups()).toEqual([]);
  });

  it("rejects path-breaking confirmUpload backup ids before reading or changing storage", async () => {
    const api = createPrivateBackupApiDeps({
      objects: new Map([[`${USER_ID}/nested/backup-1.json`, ENCRYPTED_BACKUP_OBJECT]]),
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest(
        {
          action: "confirmUpload",
          ...metadataPayload(),
          backupId: "nested/backup-1",
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_metadata",
    });
    expect(api.store.loadBackup).not.toHaveBeenCalled();
    expect(api.store.downloadObject).not.toHaveBeenCalled();
    expect(api.store.confirmedBackups()).toEqual([]);
    expect(api.store.deletedObjects()).toEqual([]);
  });

  it("rejects invalid metadata before reading or changing backup storage", async () => {
    const api = createPrivateBackupApiDeps({
      objects: new Map([[`${USER_ID}/${BACKUP_ID}.json`, ENCRYPTED_BACKUP_OBJECT]]),
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest(
        {
          action: "confirmUpload",
          ...metadataPayload(),
          ciphertextSha256: "not-a-sha",
        },
        "valid-token"
      ),
      api.deps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "invalid_metadata",
    });
    expect(api.store.downloadObject).not.toHaveBeenCalled();
    expect(api.store.confirmedBackups()).toEqual([]);
    expect(api.store.deletedObjects()).toEqual([]);
  });

  it("rejects missing objects and hash mismatches without hiding the current backup", async () => {
    const current = metadataRow({
      backupId: "backup-current",
      createdAt: "2026-04-25T10:00:00.000Z",
    });
    const missingObjectApi = createPrivateBackupApiDeps({ backups: [current] });

    const missingObjectResponse = await handlePrivateBackupRequest(
      jsonRequest({ action: "confirmUpload", ...metadataPayload() }, "valid-token"),
      missingObjectApi.deps
    );

    expect(missingObjectResponse.status).toBe(400);
    await expect(missingObjectResponse.json()).resolves.toEqual({
      success: false,
      error: "missing_object",
    });
    expect(missingObjectApi.store.confirmedBackups()).toEqual([]);
    expect(missingObjectApi.store.deletedObjects()).toEqual([]);
    expect(missingObjectApi.store.currentBackup()).toEqual(current);

    const hashMismatchApi = createPrivateBackupApiDeps({
      backups: [current],
      objects: new Map([[`${USER_ID}/${BACKUP_ID}.json`, new TextEncoder().encode("wrong")]]),
    });

    const hashMismatchResponse = await handlePrivateBackupRequest(
      jsonRequest({ action: "confirmUpload", ...metadataPayload() }, "valid-token"),
      hashMismatchApi.deps
    );

    expect(hashMismatchResponse.status).toBe(400);
    await expect(hashMismatchResponse.json()).resolves.toEqual({
      success: false,
      error: "metadata_mismatch",
    });
    expect(hashMismatchApi.store.confirmedBackups()).toEqual([]);
    expect(hashMismatchApi.store.deletedObjects()).toEqual([]);
    expect(hashMismatchApi.store.currentBackup()).toEqual(current);
  });

  it("treats matching confirmUpload retries as idempotent", async () => {
    const existing = metadataRow({ backupId: BACKUP_ID });
    const api = createPrivateBackupApiDeps({ backups: [existing] });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "confirmUpload", ...metadataPayload() }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      backup: existing,
    });
    expect(api.store.confirmedBackups()).toEqual([]);
  });

  it("persists the new backup before deleting every previous confirmed backup", async () => {
    const previousLatest = metadataRow({
      backupId: "backup-previous-latest",
      createdAt: "2026-04-25T10:00:00.000Z",
    });
    const previousOlder = metadataRow({
      backupId: "backup-previous-older",
      createdAt: "2026-04-24T10:00:00.000Z",
    });
    const api = createPrivateBackupApiDeps({
      backups: [previousLatest, previousOlder],
      objects: new Map([[`${USER_ID}/${BACKUP_ID}.json`, ENCRYPTED_BACKUP_OBJECT]]),
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "confirmUpload", ...metadataPayload() }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    expect(api.store.operations()).toEqual([
      `confirm:${USER_ID}/${BACKUP_ID}`,
      `deleteMetadata:${USER_ID}/backup-previous-latest`,
      `deleteMetadata:${USER_ID}/backup-previous-older`,
      `deleteObject:${USER_ID}/backup-previous-latest.json`,
      `deleteObject:${USER_ID}/backup-previous-older.json`,
    ]);
    expect(api.store.currentBackup()).toEqual(metadataRow({ backupId: BACKUP_ID }));
  });

  it("returns confirmed metadata when previous backup cleanup fails", async () => {
    const api = createPrivateBackupApiDeps({
      backups: [legacyMetadataRow()],
      deleteBackupMetadataError: new Error("delete failed"),
      objects: new Map([[`${USER_ID}/${BACKUP_ID}.json`, ENCRYPTED_BACKUP_OBJECT]]),
    });

    const response = await handlePrivateBackupRequest(
      jsonRequest({ action: "confirmUpload", ...metadataPayload() }, "valid-token"),
      api.deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      backup: metadataRow({ backupId: BACKUP_ID }),
    });
    expect(api.store.confirmedBackups()).toEqual([metadataRow({ backupId: BACKUP_ID })]);
  });

  it("prepares downloads for the current backup and deletes every authenticated-user backup", async () => {
    const current = metadataRow({ backupId: BACKUP_ID });
    const api = createPrivateBackupApiDeps({ backups: [current, legacyMetadataRow()] });

    const downloadResponse = await handlePrivateBackupRequest(
      jsonRequest({ action: "prepareDownload" }, "valid-token"),
      api.deps
    );

    await expectCurrentDownloadResponse(downloadResponse, current);

    const deleteResponse = await handlePrivateBackupRequest(
      jsonRequest({ action: "deleteCurrent", backupId: "ignored" }, "valid-token"),
      api.deps
    );

    await expectDeleteCurrentResponse(deleteResponse);
    expectDeletedBackupOperations(api.store.operations(), [BACKUP_ID, "backup-legacy"]);
    expect(api.store.currentBackup()).toBeNull();
  });
});

function jsonRequest(body: unknown, token?: string) {
  return new Request("http://localhost/private-backup-api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
}

function createPrivateBackupApiDeps(
  options: {
    readonly authError?: { readonly message: string };
    readonly backups?: readonly RemoteBackupMetadata[];
    readonly deleteBackupMetadataError?: Error;
    readonly downloadObjectError?: Error;
    readonly objects?: ReadonlyMap<string, Uint8Array>;
    readonly rateLimit?: RateLimitResult;
    readonly rateLimitError?: Error;
    readonly userId?: string;
  } = {}
) {
  const store = createPrivateBackupStore(options);
  const allowedRateLimit = { allowed: true } satisfies RateLimitResult;
  const rateLimit = vi.fn(() =>
    options.rateLimitError === undefined
      ? Promise.resolve(options.rateLimit ?? allowedRateLimit)
      : Promise.reject(options.rateLimitError)
  );
  return {
    rateLimit,
    store,
    deps: {
      auth: {
        auth: {
          getUser: vi.fn(() => Promise.resolve(authResponse(options))),
        },
      },
      rateLimit,
      store,
    },
  };
}

function authResponse(options: {
  readonly authError?: { readonly message: string };
  readonly userId?: string;
}) {
  return {
    data: { user: authUser(options) },
    error: options.authError ?? null,
  };
}

function authUser(options: {
  readonly authError?: { readonly message: string };
  readonly userId?: string;
}) {
  return options.authError === undefined ? { id: options.userId ?? USER_ID } : null;
}

type RemoteBackupMetadata = {
  readonly userId: string;
  readonly backupId: string;
  readonly createdAt: string;
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly deviceLabel: string;
  readonly ciphertextSizeBytes: number;
  readonly ciphertextSha256: string;
};

type RateLimitResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

function metadataPayload() {
  return {
    backupId: BACKUP_ID,
    createdAt: CREATED_AT,
    schemaVersion: 1,
    appVersion: "1.2.3",
    deviceLabel: "iPhone 17",
    ciphertextSizeBytes: CIPHERTEXT.byteLength,
    ciphertextSha256: SHA256,
  };
}

function metadataRow(overrides: Partial<RemoteBackupMetadata> = {}): RemoteBackupMetadata {
  return {
    userId: USER_ID,
    backupId: BACKUP_ID,
    createdAt: CREATED_AT,
    schemaVersion: 1,
    appVersion: "1.2.3",
    deviceLabel: "iPhone 17",
    ciphertextSizeBytes: CIPHERTEXT.byteLength,
    ciphertextSha256: SHA256,
    ...overrides,
  };
}

function legacyMetadataRow() {
  return metadataRow({
    backupId: "backup-legacy",
    createdAt: "2026-04-25T10:00:00.000Z",
  });
}

async function expectCurrentDownloadResponse(response: Response, current: RemoteBackupMetadata) {
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    success: true,
    backup: current,
    downloadUrl: "https://storage.example/download",
    path: `${USER_ID}/${BACKUP_ID}.json`,
    expiresInSeconds: 300,
  });
}

async function expectDeleteCurrentResponse(response: Response) {
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ success: true });
}

function expectDeletedBackupOperations(
  operations: readonly string[],
  backupIds: readonly string[]
) {
  backupIds.forEach((backupId) => {
    expect(operations).toContain(`deleteMetadata:${USER_ID}/${backupId}`);
    expect(operations).toContain(`deleteObject:${USER_ID}/${backupId}.json`);
  });
}

function expectNoStoreCalls(store: ReturnType<typeof createPrivateBackupStore>) {
  expect(store.loadBackup).not.toHaveBeenCalled();
  expect(store.listBackups).not.toHaveBeenCalled();
  expect(store.loadCurrentBackup).not.toHaveBeenCalled();
  expect(store.createSignedUploadUrl).not.toHaveBeenCalled();
  expect(store.createSignedDownloadUrl).not.toHaveBeenCalled();
  expect(store.downloadObject).not.toHaveBeenCalled();
  expect(store.confirmBackup).not.toHaveBeenCalled();
  expect(store.deleteBackupMetadata).not.toHaveBeenCalled();
  expect(store.deleteObject).not.toHaveBeenCalled();
}

function createPrivateBackupStore(options: {
  readonly backups?: readonly RemoteBackupMetadata[];
  readonly deleteBackupMetadataError?: Error;
  readonly downloadObjectError?: Error;
  readonly objects?: ReadonlyMap<string, Uint8Array>;
}) {
  const backups = new Map(
    (options.backups ?? []).map((backup) => [`${backup.userId}/${backup.backupId}`, backup])
  );
  const confirmed: RemoteBackupMetadata[] = [];
  const uploadUrls: string[] = [];
  const uploadUrlOptions: unknown[] = [];
  const downloadUrls: string[] = [];
  const deletedObjects: string[] = [];
  const operationLog: string[] = [];

  const store = {
    loadBackup: vi.fn((userId: string, backupId: string) =>
      Promise.resolve(backups.get(`${userId}/${backupId}`) ?? null)
    ),
    listBackups: vi.fn((userId: string) =>
      Promise.resolve(
        [...backups.values()]
          .filter((backup) => backup.userId === userId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      )
    ),
    loadCurrentBackup: vi.fn((userId: string) =>
      Promise.resolve(
        [...backups.values()]
          .filter((backup) => backup.userId === userId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
      )
    ),
    createSignedUploadUrl: vi.fn((path: string, options?: unknown) => {
      uploadUrls.push(path);
      uploadUrlOptions.push(options);
      return Promise.resolve({
        signedUrl: "https://storage.example/upload",
        token: "signed-upload-token",
      });
    }),
    createSignedDownloadUrl: vi.fn((path: string) => {
      downloadUrls.push(path);
      return Promise.resolve("https://storage.example/download");
    }),
    downloadObject: vi.fn((path: string) =>
      options.downloadObjectError === undefined
        ? Promise.resolve(options.objects?.get(path) ?? null)
        : Promise.reject(options.downloadObjectError)
    ),
    confirmBackup: vi.fn((backup: RemoteBackupMetadata) => {
      operationLog.push(`confirm:${backup.userId}/${backup.backupId}`);
      confirmed.push(backup);
      backups.set(`${backup.userId}/${backup.backupId}`, backup);
      return Promise.resolve();
    }),
    deleteBackupMetadata: vi.fn((userId: string, backupId: string) => {
      operationLog.push(`deleteMetadata:${userId}/${backupId}`);
      if (options.deleteBackupMetadataError !== undefined) {
        return Promise.reject(options.deleteBackupMetadataError);
      }
      backups.delete(`${userId}/${backupId}`);
      return Promise.resolve();
    }),
    deleteObject: vi.fn((path: string) => {
      operationLog.push(`deleteObject:${path}`);
      deletedObjects.push(path);
      return Promise.resolve();
    }),
    confirmedBackups: () => confirmed,
    createdUploadUrls: () => uploadUrls,
    uploadUrlOptions: () => uploadUrlOptions,
    createdDownloadUrls: () => downloadUrls,
    deletedObjects: () => deletedObjects,
    operations: () => operationLog,
    currentBackup: () =>
      [...backups.values()]
        .filter((backup) => backup.userId === USER_ID)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null,
  };

  return store;
}
