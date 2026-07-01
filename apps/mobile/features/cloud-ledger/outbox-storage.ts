import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { requireLedgerChangeId } from "@/shared/types/assertions";
import type { UserId } from "@/shared/types/branded";
import type { CloudLedgerPendingChangeOutcome } from "./api-client";
import { parsePendingChange, type CloudLedgerPendingChange } from "./pending-changes";
import type { CloudLedgerAutoRetryState, CloudLedgerRepairState } from "./repair-policy";

export type EncryptedCloudLedgerOutboxSnapshot = {
  readonly version: 1;
  readonly algorithm: "AES-GCM";
  readonly nonce: string;
  readonly ciphertext: string;
};

export type EncryptedCloudLedgerOutboxStorage = {
  readonly read: () => Promise<EncryptedCloudLedgerOutboxSnapshot | null>;
  readonly write: (snapshot: EncryptedCloudLedgerOutboxSnapshot) => Promise<void>;
  readonly clear: () => Promise<void>;
};

export type SecureStoreOutboxPayloadCheckpoint = {
  readonly restore: () => Promise<void>;
};

export type CloudLedgerOutboxSnapshot = {
  readonly version: 1;
  readonly changes: readonly CloudLedgerPendingChange[];
  readonly retryAttempts: readonly CloudLedgerAutoRetryState[];
  readonly repairs: readonly CloudLedgerRepairState[];
};

export type CloudLedgerOutboxFailureCode = "invalid_encrypted_outbox";

type SecureStoreOutboxChunkAllocation = {
  readonly generation: number | null;
  readonly chunkCount: number;
};
type ChunkedSecureStoreOutboxManifest = {
  readonly version: 1;
  readonly storage: typeof CHUNKED_SECURE_STORE_OUTBOX_STORAGE;
  readonly generation: number | null;
  readonly chunkCount: number;
  readonly allocatedChunkCount: number;
  readonly allocatedGenerations: readonly SecureStoreOutboxChunkAllocation[];
};

const CLOUD_LEDGER_OUTBOX_VERSION = 1;
const GCM_NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;
const OUTBOX_KEY_BYTES = 32;
const OUTBOX_KEY_PATTERN = /^[0-9a-f]{64}$/;
const SECURE_STORE_OUTBOX_CHUNK_SIZE = 1500;
const CHUNKED_SECURE_STORE_OUTBOX_STORAGE = "chunked-secure-store";

export class CloudLedgerOutboxFailure extends Error {
  constructor(
    readonly code: CloudLedgerOutboxFailureCode,
    message: string
  ) {
    super(message);
    this.name = "CloudLedgerOutboxFailure";
  }
}

export async function loadOutboxSnapshot(
  storage: EncryptedCloudLedgerOutboxStorage,
  encryptionKey: Uint8Array
): Promise<CloudLedgerOutboxSnapshot> {
  const encrypted = await storage.read();
  return encrypted === null
    ? { version: CLOUD_LEDGER_OUTBOX_VERSION, changes: [], retryAttempts: [], repairs: [] }
    : await decryptOutboxSnapshot(encrypted, encryptionKey);
}

export async function writeOutboxSnapshot(
  storage: EncryptedCloudLedgerOutboxStorage,
  encryptionKey: Uint8Array,
  snapshot: CloudLedgerOutboxSnapshot
): Promise<void> {
  await storage.write(
    await encryptOutboxSnapshot(serializeOutboxSnapshot(snapshot), encryptionKey)
  );
}

export function createSecureStoreCloudLedgerOutboxStorage(
  userId: UserId
): EncryptedCloudLedgerOutboxStorage {
  const key = secureStoreOutboxKey(userId);
  return {
    clear: () => clearSecureStoreOutboxPayload(key),
    read: async () => parseEncryptedOutboxSnapshot(await readSecureStoreOutboxPayload(key)),
    write: (snapshot) => writeSecureStoreOutboxPayload(key, JSON.stringify(snapshot)),
  };
}

export function secureStoreOutboxKey(userId: UserId): string {
  return `cloud-ledger-outbox_${toSecureStoreKeyFragment(userId)}`;
}

export function secureStoreOutboxEncryptionKey(userId: UserId): string {
  return `cloud-ledger-outbox-key_${toSecureStoreKeyFragment(userId)}`;
}

export function getOrCreateOutboxEncryptionKey(userId: UserId): Uint8Array {
  const key = secureStoreOutboxEncryptionKey(userId);
  const existing = SecureStore.getItem(key);
  if (existing !== null && OUTBOX_KEY_PATTERN.test(existing)) {
    return fromHex(existing);
  }

  const bytes = Crypto.getRandomBytes(OUTBOX_KEY_BYTES);
  SecureStore.setItem(key, toHex(bytes));
  return bytes;
}

export function getExistingOutboxEncryptionKey(userId: UserId): Uint8Array | null {
  const existing = SecureStore.getItem(secureStoreOutboxEncryptionKey(userId));
  return existing !== null && OUTBOX_KEY_PATTERN.test(existing) ? fromHex(existing) : null;
}

export async function clearSecureStoreOutboxPayload(key: string): Promise<void> {
  const [payload, manifest, stagedAllocation] = await Promise.all([
    readSecureStoreOutboxPayload(key).catch(() => null),
    SecureStore.getItemAsync(key).then(parseChunkedOutboxManifest),
    SecureStore.getItemAsync(secureStoreOutboxStagedKey(key)).then(parseStagedChunkAllocation),
  ]);
  const allocations = mergeChunkAllocations([
    ...(manifest?.allocatedGenerations ?? []),
    ...(stagedAllocation === null ? [] : [stagedAllocation]),
  ]);
  const deleteResults = await Promise.allSettled([
    SecureStore.deleteItemAsync(key),
    SecureStore.deleteItemAsync(secureStoreOutboxStagedKey(key)),
    ...allocations.flatMap((allocation) =>
      secureStoreOutboxChunkKeys(key, allocation).map((chunkKey) =>
        SecureStore.deleteItemAsync(chunkKey)
      )
    ),
  ]);
  const failedDelete = deleteResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );
  if (failedDelete === undefined) {
    return;
  }
  if (payload !== null) {
    await writeSecureStoreOutboxPayload(key, payload, allocations);
  }
  throw failedDelete.reason;
}

export async function createSecureStoreOutboxPayloadCheckpoint(
  key: string
): Promise<SecureStoreOutboxPayloadCheckpoint> {
  const payload = await readSecureStoreOutboxPayload(key).catch(() => null);
  return {
    restore: async () => {
      if (payload !== null) {
        await writeSecureStoreOutboxPayload(key, payload);
      }
    },
  };
}

async function encryptOutboxSnapshot(
  snapshot: unknown,
  encryptionKey: Uint8Array
): Promise<EncryptedCloudLedgerOutboxSnapshot> {
  const nonce = Crypto.getRandomBytes(GCM_NONCE_BYTES);
  const sealedData = await Crypto.aesEncryptAsync(
    encodeJson(snapshot),
    await Crypto.AESEncryptionKey.import(encryptionKey),
    {
      nonce: { bytes: nonce },
      tagLength: GCM_TAG_BYTES,
    }
  );
  return {
    version: CLOUD_LEDGER_OUTBOX_VERSION,
    algorithm: "AES-GCM",
    nonce: await sealedData.iv("base64"),
    ciphertext: await sealedData.ciphertext({ includeTag: true, encoding: "base64" }),
  };
}

function serializeOutboxSnapshot(snapshot: CloudLedgerOutboxSnapshot): unknown {
  return {
    ...snapshot,
    changes: snapshot.changes.map(serializePendingChange),
  };
}

function serializePendingChange(change: CloudLedgerPendingChange): unknown {
  return change.kind === "unsupported" ? change.rawCommand : change;
}

async function decryptOutboxSnapshot(
  snapshot: EncryptedCloudLedgerOutboxSnapshot,
  encryptionKey: Uint8Array
): Promise<CloudLedgerOutboxSnapshot> {
  try {
    if (snapshot.version !== CLOUD_LEDGER_OUTBOX_VERSION || snapshot.algorithm !== "AES-GCM") {
      throw new Error("unsupported Cloud Ledger outbox snapshot");
    }
    const plaintext = await Crypto.aesDecryptAsync(
      Crypto.AESSealedData.fromParts(snapshot.nonce, snapshot.ciphertext, GCM_TAG_BYTES),
      await Crypto.AESEncryptionKey.import(encryptionKey),
      { output: "bytes" }
    );
    return parseOutboxSnapshot(JSON.parse(decodeUtf8(plaintext)));
  } catch (error) {
    throw new CloudLedgerOutboxFailure(
      "invalid_encrypted_outbox",
      error instanceof Error ? error.message : "Invalid Cloud Ledger outbox"
    );
  }
}

function parseOutboxSnapshot(value: unknown): CloudLedgerOutboxSnapshot {
  const record = requireRecord(value, "outbox snapshot");
  if (record.version !== CLOUD_LEDGER_OUTBOX_VERSION) {
    throw new Error("outbox snapshot version must be supported");
  }
  return {
    version: CLOUD_LEDGER_OUTBOX_VERSION,
    changes: requireArray(record.changes, "changes").map(parsePendingChange),
    retryAttempts:
      record.retryAttempts === undefined
        ? []
        : requireArray(record.retryAttempts, "retryAttempts").map(parseAutoRetryState),
    repairs:
      record.repairs === undefined
        ? []
        : requireArray(record.repairs, "repairs").map(parseRepairState),
  };
}

function parseAutoRetryState(value: unknown): CloudLedgerAutoRetryState {
  const record = requireRecord(value, "auto retry state");
  return {
    changeId: requireLedgerChangeId(requireString(record.changeId, "auto retry changeId")),
    attempts: requireNonNegativeInteger(record.attempts, "auto retry attempts"),
  };
}

function parseRepairState(value: unknown): CloudLedgerRepairState {
  const record = requireRecord(value, "repair state");
  const outcome = requireRecord(record.outcome, "repair outcome");
  return {
    changeId: requireLedgerChangeId(requireString(record.changeId, "repair changeId")),
    outcome: {
      changeId: requireLedgerChangeId(requireString(outcome.changeId, "repair outcome changeId")),
      status: requireRepairOutcomeStatus(outcome.status),
      code: requireString(outcome.code, "repair outcome code"),
    },
    ...(record.acceptedTransactionVersion === undefined
      ? {}
      : {
          acceptedTransactionVersion: requirePositiveInteger(
            record.acceptedTransactionVersion,
            "repair acceptedTransactionVersion"
          ),
        }),
    ...(record.parentChangeId === undefined
      ? {}
      : {
          parentChangeId: requireLedgerChangeId(
            requireString(record.parentChangeId, "repair parentChangeId")
          ),
        }),
  };
}

function requireRepairOutcomeStatus(value: unknown): CloudLedgerPendingChangeOutcome["status"] {
  if (
    value === "accepted" ||
    value === "repair_required" ||
    value === "requires_app_update" ||
    value === "retryable"
  ) {
    return value;
  }
  throw new Error("repair outcome status must be supported");
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function toSecureStoreKeyFragment(value: string): string {
  return encodeURIComponent(value)
    .replaceAll("%", "_")
    .replaceAll(/[^A-Za-z0-9._-]/g, "_");
}

function secureStoreOutboxChunkKey(
  key: string,
  allocation: Pick<SecureStoreOutboxChunkAllocation, "generation">,
  index: number
): string {
  return allocation.generation === null
    ? `${key}_chunk_${index}`
    : `${key}_generation_${allocation.generation}_chunk_${index}`;
}

function secureStoreOutboxStagedKey(key: string): string {
  return `${key}_staged`;
}

function chunkString(value: string): readonly string[] {
  return Array.from(
    { length: Math.ceil(value.length / SECURE_STORE_OUTBOX_CHUNK_SIZE) },
    (_, index) =>
      value.slice(
        index * SECURE_STORE_OUTBOX_CHUNK_SIZE,
        (index + 1) * SECURE_STORE_OUTBOX_CHUNK_SIZE
      )
  );
}

function parseChunkedOutboxManifest(value: string | null): ChunkedSecureStoreOutboxManifest | null {
  if (value === null) {
    return null;
  }
  try {
    const record = requireRecord(JSON.parse(value), "chunked outbox manifest");
    if (record.storage !== CHUNKED_SECURE_STORE_OUTBOX_STORAGE) {
      return null;
    }
    const generation =
      record.generation === undefined
        ? null
        : requireNonNegativeInteger(record.generation, "chunk generation");
    const chunkCount = requireNonNegativeInteger(record.chunkCount, "chunk count");
    const allocatedChunkCount =
      record.allocatedChunkCount === undefined
        ? chunkCount
        : requireNonNegativeInteger(record.allocatedChunkCount, "allocated chunk count");
    const allocatedGenerations = parseChunkAllocations(
      record.allocatedGenerations,
      generation,
      allocatedChunkCount
    );
    requireChunkAllocationCoverage(allocatedGenerations, generation, chunkCount);
    return {
      version: requireOutboxVersion(record.version),
      storage: CHUNKED_SECURE_STORE_OUTBOX_STORAGE,
      generation,
      chunkCount,
      allocatedChunkCount,
      allocatedGenerations,
    };
  } catch {
    return null;
  }
}

function parseChunkAllocations(
  value: unknown,
  activeGeneration: number | null,
  allocatedChunkCount: number
): readonly SecureStoreOutboxChunkAllocation[] {
  if (value === undefined) {
    return [{ generation: activeGeneration, chunkCount: allocatedChunkCount }];
  }
  return requireArray(value, "allocated chunk generations").map((allocation) => {
    const record = requireRecord(allocation, "allocated chunk generation");
    return {
      generation:
        record.generation === null
          ? null
          : requireNonNegativeInteger(record.generation, "allocated chunk generation"),
      chunkCount: requireNonNegativeInteger(record.chunkCount, "allocated chunk count"),
    };
  });
}

function requireChunkAllocationCoverage(
  allocations: readonly SecureStoreOutboxChunkAllocation[],
  activeGeneration: number | null,
  activeChunkCount: number
): void {
  if (
    allocations.some(
      (allocation) =>
        allocation.generation === activeGeneration && allocation.chunkCount >= activeChunkCount
    )
  ) {
    return;
  }
  throw new Error("allocated chunk generations must cover active chunks");
}

function chunkIndexes(chunkCount: number): readonly number[] {
  return Array.from({ length: chunkCount }, (_, index) => index);
}

function secureStoreOutboxChunkKeys(
  key: string,
  allocation: SecureStoreOutboxChunkAllocation
): readonly string[] {
  return chunkIndexes(allocation.chunkCount).map((index) =>
    secureStoreOutboxChunkKey(key, allocation, index)
  );
}

function nextSecureStoreOutboxGeneration(input: {
  readonly previousManifest: ChunkedSecureStoreOutboxManifest | null;
  readonly stagedAllocation: SecureStoreOutboxChunkAllocation | null;
  readonly retainedAllocations: readonly SecureStoreOutboxChunkAllocation[];
}): number {
  return (
    Math.max(
      input.previousManifest?.generation ?? 0,
      input.stagedAllocation?.generation ?? 0,
      ...input.retainedAllocations.map((allocation) => allocation.generation ?? 0)
    ) + 1
  );
}

function chunkAllocationIdentity(allocation: SecureStoreOutboxChunkAllocation): string {
  return allocation.generation === null ? "legacy" : String(allocation.generation);
}

function mergeChunkAllocations(
  allocations: readonly SecureStoreOutboxChunkAllocation[]
): readonly SecureStoreOutboxChunkAllocation[] {
  return [
    ...new Map(
      allocations.map((allocation) => [chunkAllocationIdentity(allocation), allocation])
    ).values(),
  ];
}

function allocatedChunkCount(
  allocations: readonly SecureStoreOutboxChunkAllocation[],
  activeAllocation: SecureStoreOutboxChunkAllocation
): number {
  return Math.max(
    activeAllocation.chunkCount,
    ...allocations.map((allocation) => allocation.chunkCount)
  );
}

async function writeSecureStoreOutboxManifest(
  key: string,
  activeAllocation: SecureStoreOutboxChunkAllocation,
  allocatedGenerations: readonly SecureStoreOutboxChunkAllocation[]
): Promise<void> {
  await SecureStore.setItemAsync(
    key,
    JSON.stringify({
      version: CLOUD_LEDGER_OUTBOX_VERSION,
      storage: CHUNKED_SECURE_STORE_OUTBOX_STORAGE,
      generation: activeAllocation.generation,
      chunkCount: activeAllocation.chunkCount,
      allocatedChunkCount: allocatedChunkCount(allocatedGenerations, activeAllocation),
      allocatedGenerations,
    } satisfies ChunkedSecureStoreOutboxManifest)
  );
}

function parseStagedChunkAllocation(value: string | null): SecureStoreOutboxChunkAllocation | null {
  if (value === null) {
    return null;
  }
  try {
    const record = requireRecord(JSON.parse(value), "staged outbox chunks");
    if (record.storage !== CHUNKED_SECURE_STORE_OUTBOX_STORAGE) {
      return null;
    }
    return {
      generation: requireNonNegativeInteger(record.generation, "staged chunk generation"),
      chunkCount: requireNonNegativeInteger(record.chunkCount, "staged chunk count"),
    };
  } catch {
    return null;
  }
}

async function readSecureStoreOutboxPayload(key: string): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(key);
  const manifest = parseChunkedOutboxManifest(stored);
  if (manifest === null) {
    return stored;
  }

  const chunks = await Promise.all(
    chunkIndexes(manifest.chunkCount).map((index) =>
      SecureStore.getItemAsync(secureStoreOutboxChunkKey(key, manifest, index))
    )
  );
  if (chunks.some((chunk) => chunk === null)) {
    throw new Error("encrypted outbox chunk is missing");
  }
  return chunks.join("");
}

async function writeSecureStoreOutboxPayload(
  key: string,
  payload: string,
  retainedAllocations: readonly SecureStoreOutboxChunkAllocation[] = []
): Promise<void> {
  const [previousManifest, stagedAllocation] = await Promise.all([
    SecureStore.getItemAsync(key).then(parseChunkedOutboxManifest),
    SecureStore.getItemAsync(secureStoreOutboxStagedKey(key)).then(parseStagedChunkAllocation),
  ]);
  const chunks = chunkString(payload);
  const activeAllocation = {
    generation: nextSecureStoreOutboxGeneration({
      previousManifest,
      retainedAllocations,
      stagedAllocation,
    }),
    chunkCount: chunks.length,
  } satisfies SecureStoreOutboxChunkAllocation;
  const allocatedGenerations = mergeChunkAllocations([
    activeAllocation,
    ...retainedAllocations,
    ...(previousManifest?.allocatedGenerations ?? []),
    ...(stagedAllocation === null ? [] : [stagedAllocation]),
  ]);
  await SecureStore.setItemAsync(
    secureStoreOutboxStagedKey(key),
    JSON.stringify({
      version: CLOUD_LEDGER_OUTBOX_VERSION,
      storage: CHUNKED_SECURE_STORE_OUTBOX_STORAGE,
      generation: activeAllocation.generation,
      chunkCount: activeAllocation.chunkCount,
    })
  );
  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(secureStoreOutboxChunkKey(key, activeAllocation, index), chunk)
    )
  );
  await writeSecureStoreOutboxManifest(key, activeAllocation, allocatedGenerations);
  await cleanupSecureStoreOutboxChunks(key, activeAllocation, allocatedGenerations);
}

async function cleanupSecureStoreOutboxChunks(
  key: string,
  activeAllocation: SecureStoreOutboxChunkAllocation,
  allocatedGenerations: readonly SecureStoreOutboxChunkAllocation[]
): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(secureStoreOutboxStagedKey(key)),
      ...allocatedGenerations
        .filter((allocation) => allocation.generation !== activeAllocation.generation)
        .flatMap((allocation) =>
          secureStoreOutboxChunkKeys(key, allocation).map((chunkKey) =>
            SecureStore.deleteItemAsync(chunkKey)
          )
        ),
    ]);
    await writeSecureStoreOutboxManifest(key, activeAllocation, [activeAllocation]);
  } catch {
    // Cleanup is best-effort after the active manifest flip. The manifest keeps
    // stale allocations so logout can still remove chunks that failed cleanup.
  }
}

function parseEncryptedOutboxSnapshot(
  value: string | null
): EncryptedCloudLedgerOutboxSnapshot | null {
  if (value === null) {
    return null;
  }
  const parsed = JSON.parse(value);
  const record = requireRecord(parsed, "encrypted outbox snapshot");
  return {
    version: requireOutboxVersion(record.version),
    algorithm: requireOutboxAlgorithm(record.algorithm),
    nonce: requireString(record.nonce, "encrypted outbox nonce"),
    ciphertext: requireString(record.ciphertext, "encrypted outbox ciphertext"),
  };
}

function requireOutboxVersion(value: unknown): typeof CLOUD_LEDGER_OUTBOX_VERSION {
  if (value === CLOUD_LEDGER_OUTBOX_VERSION) {
    return CLOUD_LEDGER_OUTBOX_VERSION;
  }
  throw new Error("encrypted outbox version must be supported");
}

function requireOutboxAlgorithm(value: unknown): "AES-GCM" {
  if (value === "AES-GCM") {
    return "AES-GCM";
  }
  throw new Error("encrypted outbox algorithm must be AES-GCM");
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${label} must be an object`);
}

function requireArray(value: unknown, label: string): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  throw new Error(`${label} must be an array`);
}

function requireString(value: unknown, label: string): string {
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`${label} must be a string`);
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value === "number") {
    return value;
  }
  throw new Error(`${label} must be a number`);
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  const number = requireNumber(value, label);
  if (Number.isInteger(number) && number >= 0) {
    return number;
  }
  throw new Error(`${label} must be a non-negative integer`);
}

function requirePositiveInteger(value: unknown, label: string): number {
  const number = requireNumber(value, label);
  if (Number.isInteger(number) && number > 0) {
    return number;
  }
  throw new Error(`${label} must be a positive integer`);
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  return Uint8Array.from(value.match(/.{1,2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}
