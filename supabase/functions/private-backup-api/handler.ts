import {
  metadataMatches,
  readRemoteBackupMetadata,
  uploadedObjectMatchesMetadata,
} from "./metadata.ts";
import type { RemoteBackupMetadata, SignedUploadUrl } from "./model.ts";

type SupabaseError = { readonly message?: string } | null;

type AuthClient = {
  readonly auth: {
    getUser(token: string): Promise<{
      readonly data: { readonly user: { readonly id: string } | null };
      readonly error: SupabaseError;
    }>;
  };
};

type ServiceClient = {
  loadBackup(userId: string, backupId: string): Promise<RemoteBackupMetadata | null>;
  listBackups(userId: string): Promise<readonly RemoteBackupMetadata[]>;
  loadCurrentBackup(userId: string): Promise<RemoteBackupMetadata | null>;
  createSignedUploadUrl(path: string): Promise<SignedUploadUrl>;
  createSignedDownloadUrl(path: string): Promise<string>;
  downloadObject(path: string): Promise<Uint8Array | null>;
  confirmBackup(metadata: RemoteBackupMetadata): Promise<void>;
  deleteBackupMetadata(userId: string, backupId: string): Promise<void>;
  deleteObject(path: string): Promise<void>;
};

export type PrivateBackupApiDeps = {
  readonly auth: AuthClient;
  readonly store: ServiceClient;
};

const SIGNED_URL_EXPIRES_IN_SECONDS = 300;
const BACKUP_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export async function handlePrivateBackupRequest(
  request: Request,
  deps: PrivateBackupApiDeps
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader === null) {
    return jsonResponse({ success: false, error: "missing_auth" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await deps.auth.auth.getUser(token);

  if (error !== null || user === null) {
    return jsonResponse({ success: false, error: "invalid_auth" }, 401);
  }

  const body = await readJsonBody(request);
  try {
    return await routeAuthenticatedRequest(deps.store, user.id, body);
  } catch {
    return jsonResponse({ success: false, error: "internal_error" }, 500);
  }
}

async function routeAuthenticatedRequest(store: ServiceClient, userId: string, body: unknown) {
  const action = readAction(body);
  if (action === "current") {
    return currentResponse(store, userId);
  }
  if (action === "prepareUpload") {
    return prepareUploadResponse(store, userId, body);
  }
  if (action === "confirmUpload") {
    return confirmUploadResponse(store, userId, body);
  }
  if (action === "prepareDownload") {
    return prepareDownloadResponse(store, userId);
  }
  if (action === "deleteCurrent") {
    return deleteCurrentResponse(store, userId);
  }

  return jsonResponse({ success: false, error: "unsupported_action" }, 400);
}

async function currentResponse(store: ServiceClient, userId: string) {
  const backup = await store.loadCurrentBackup(userId);
  return jsonResponse({ success: true, backup });
}

async function prepareUploadResponse(store: ServiceClient, userId: string, body: unknown) {
  const backupId = readRequiredBackupId(body);
  if (backupId === null) {
    return jsonResponse({ success: false, error: "invalid_metadata" }, 400);
  }

  const existing = await store.loadBackup(userId, backupId);
  if (existing !== null) {
    return jsonResponse({ success: false, error: "backup_already_confirmed" }, 409);
  }

  const path = buildBackupPath(userId, backupId);
  const upload = await store.createSignedUploadUrl(path);
  return jsonResponse({
    success: true,
    uploadUrl: upload.signedUrl,
    uploadToken: upload.token,
    path,
    expiresInSeconds: SIGNED_URL_EXPIRES_IN_SECONDS,
  });
}

async function confirmUploadResponse(store: ServiceClient, userId: string, body: unknown) {
  const metadata = readRemoteBackupMetadata(body, userId);
  if (metadata === null || !isBackupIdSegment(metadata.backupId)) {
    return jsonResponse({ success: false, error: "invalid_metadata" }, 400);
  }

  const existing = await store.loadBackup(userId, metadata.backupId);
  if (existing !== null) {
    return metadataMatches(existing, metadata)
      ? jsonResponse({ success: true, backup: existing })
      : jsonResponse({ success: false, error: "backup_already_confirmed" }, 409);
  }

  const path = buildBackupPath(userId, metadata.backupId);
  const bytes = await store.downloadObject(path);
  if (bytes === null) {
    return jsonResponse({ success: false, error: "missing_object" }, 400);
  }
  if (!(await uploadedObjectMatchesMetadata(bytes, metadata))) {
    return jsonResponse({ success: false, error: "metadata_mismatch" }, 400);
  }

  const previousBackups = await store.listBackups(userId);
  await store.confirmBackup(metadata);
  await deletePreviousBackups(store, userId, metadata.backupId, previousBackups);

  return jsonResponse({ success: true, backup: metadata });
}

async function prepareDownloadResponse(store: ServiceClient, userId: string) {
  const backup = await store.loadCurrentBackup(userId);
  if (backup === null) {
    return jsonResponse({ success: false, error: "backup_not_found" }, 404);
  }

  const path = buildBackupPath(userId, backup.backupId);
  const downloadUrl = await store.createSignedDownloadUrl(path);
  return jsonResponse({
    success: true,
    backup,
    downloadUrl,
    path,
    expiresInSeconds: SIGNED_URL_EXPIRES_IN_SECONDS,
  });
}

async function deleteCurrentResponse(store: ServiceClient, userId: string) {
  const backups = await store.listBackups(userId);
  await deleteBackups(store, userId, backups);
  return jsonResponse({ success: true });
}

function buildBackupPath(userId: string, backupId: string) {
  return `${userId}/${backupId}.json`;
}

async function deletePreviousBackups(
  store: ServiceClient,
  userId: string,
  confirmedBackupId: string,
  previousBackups: readonly RemoteBackupMetadata[]
) {
  await Promise.allSettled(
    previousBackups
      .filter((backup) => backup.backupId !== confirmedBackupId)
      .map((backup) => deleteBackup(store, userId, backup.backupId))
  );
}

async function deleteBackups(
  store: ServiceClient,
  userId: string,
  backups: readonly RemoteBackupMetadata[]
) {
  await Promise.all(backups.map((backup) => deleteBackup(store, userId, backup.backupId)));
}

async function deleteBackup(store: ServiceClient, userId: string, backupId: string) {
  await store.deleteBackupMetadata(userId, backupId);
  await store.deleteObject(buildBackupPath(userId, backupId));
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function readAction(body: unknown) {
  return readRequiredString(body, "action");
}

function readRequiredBackupId(body: unknown): string | null {
  const backupId = readRequiredString(body, "backupId");
  return backupId !== null && isBackupIdSegment(backupId) ? backupId : null;
}

function isBackupIdSegment(value: string): boolean {
  return BACKUP_ID_PATTERN.test(value);
}

function readRequiredString(body: unknown, key: string): string | null {
  if (body === null || typeof body !== "object" || !(key in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}
