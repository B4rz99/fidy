import type { RemoteBackupMetadata } from "./model.ts";

export async function uploadedObjectMatchesMetadata(
  objectBytes: Uint8Array,
  metadata: RemoteBackupMetadata
): Promise<boolean> {
  const ciphertext = readCiphertext(objectBytes);
  if (ciphertext === null) {
    return false;
  }

  return (
    ciphertext.byteLength === metadata.ciphertextSizeBytes &&
    (await sha256Hex(ciphertext)) === metadata.ciphertextSha256
  );
}

export function readRemoteBackupMetadata(
  body: unknown,
  userId: string
): RemoteBackupMetadata | null {
  const backupId = readRequiredString(body, "backupId");
  const createdAt = readRequiredString(body, "createdAt");
  const schemaVersion = readRequiredPositiveInteger(body, "schemaVersion");
  const appVersion = readRequiredString(body, "appVersion");
  const deviceLabel = readRequiredString(body, "deviceLabel");
  const ciphertextSizeBytes = readRequiredPositiveInteger(body, "ciphertextSizeBytes");
  const ciphertextSha256 = readRequiredString(body, "ciphertextSha256");
  if (
    backupId === null ||
    createdAt === null ||
    schemaVersion === null ||
    appVersion === null ||
    deviceLabel === null ||
    ciphertextSizeBytes === null ||
    ciphertextSha256 === null ||
    !/^[0-9a-f]{64}$/.test(ciphertextSha256)
  ) {
    return null;
  }

  return {
    userId,
    backupId,
    createdAt,
    schemaVersion,
    appVersion,
    deviceLabel,
    ciphertextSizeBytes,
    ciphertextSha256,
  };
}

export function metadataMatches(left: RemoteBackupMetadata, right: RemoteBackupMetadata) {
  return (
    left.userId === right.userId &&
    left.backupId === right.backupId &&
    left.createdAt === right.createdAt &&
    left.schemaVersion === right.schemaVersion &&
    left.appVersion === right.appVersion &&
    left.deviceLabel === right.deviceLabel &&
    left.ciphertextSizeBytes === right.ciphertextSizeBytes &&
    left.ciphertextSha256 === right.ciphertextSha256
  );
}

function readCiphertext(objectBytes: Uint8Array): Uint8Array | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(objectBytes)) as {
      readonly ciphertext?: unknown;
    };
    return typeof parsed.ciphertext === "string" ? fromBase64(parsed.ciphertext) : null;
  } catch {
    return null;
  }
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readRequiredString(body: unknown, key: string): string | null {
  if (body === null || typeof body !== "object" || !(key in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readRequiredPositiveInteger(body: unknown, key: string): number | null {
  if (body === null || typeof body !== "object" || !(key in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}
