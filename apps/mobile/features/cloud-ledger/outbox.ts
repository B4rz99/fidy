import type { SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import {
  requireCategoryId,
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerChangeId,
  requireTransactionId,
} from "@/shared/types/assertions";
import type { IsoDateTime, LedgerChangeId, UserId } from "@/shared/types/branded";
import { applyPendingCloudLedgerChanges } from "./api-client";
import {
  refreshCloudLedgerCache,
  withTransactionProjection,
  type CloudLedgerCache,
  type CloudLedgerCreateTransactionCommand,
  type CloudLedgerTransaction,
} from "./cache";

export type CloudLedgerPendingCreateTransaction = {
  readonly id: LedgerChangeId;
  readonly kind: "createTransaction";
  readonly commandVersion: 1;
  readonly transaction: CloudLedgerCreateTransactionCommand["transaction"];
  readonly createdAt: IsoDateTime;
};

export type CloudLedgerPendingChange = CloudLedgerPendingCreateTransaction;

export type EncryptedCloudLedgerOutboxSnapshot = {
  readonly version: typeof CLOUD_LEDGER_OUTBOX_VERSION;
  readonly algorithm: "AES-GCM";
  readonly nonce: string;
  readonly ciphertext: string;
};

export type EncryptedCloudLedgerOutboxStorage = {
  readonly read: () => Promise<EncryptedCloudLedgerOutboxSnapshot | null>;
  readonly write: (snapshot: EncryptedCloudLedgerOutboxSnapshot) => Promise<void>;
  readonly clear: () => Promise<void>;
};

export type EncryptedCloudLedgerOutbox = {
  readonly load: () => Promise<readonly CloudLedgerPendingChange[]>;
  readonly enqueue: (
    change: CloudLedgerPendingChange
  ) => Promise<readonly CloudLedgerPendingChange[]>;
  readonly remove: (changeIds: readonly LedgerChangeId[]) => Promise<void>;
  readonly clear: () => Promise<void>;
};

export type CloudLedgerOutboxFailureCode = "invalid_encrypted_outbox";

type CloudLedgerOutboxSnapshot = {
  readonly version: typeof CLOUD_LEDGER_OUTBOX_VERSION;
  readonly changes: readonly CloudLedgerPendingChange[];
};
type SecureStoreOutboxChunkAllocation = {
  readonly generation: number | null;
  readonly chunkCount: number;
};
type ChunkedSecureStoreOutboxManifest = {
  readonly version: typeof CLOUD_LEDGER_OUTBOX_VERSION;
  readonly storage: typeof CHUNKED_SECURE_STORE_OUTBOX_STORAGE;
  readonly generation: number | null;
  readonly chunkCount: number;
  readonly allocatedChunkCount: number;
  readonly allocatedGenerations: readonly SecureStoreOutboxChunkAllocation[];
};

const CLOUD_LEDGER_OUTBOX_VERSION = 1;
const GCM_NONCE_BYTES = 12;
const OUTBOX_KEY_BYTES = 32;
const OUTBOX_KEY_PATTERN = /^[0-9a-f]{64}$/;
const SECURE_STORE_OUTBOX_CHUNK_SIZE = 1500;
const CHUNKED_SECURE_STORE_OUTBOX_STORAGE = "chunked-secure-store";
const outboxesByUserId = new Map<string, EncryptedCloudLedgerOutbox>();

export class CloudLedgerOutboxFailure extends Error {
  constructor(
    readonly code: CloudLedgerOutboxFailureCode,
    message: string
  ) {
    super(message);
    this.name = "CloudLedgerOutboxFailure";
  }
}

export function createEncryptedCloudLedgerOutbox(input: {
  readonly encryptionKey: Uint8Array;
  readonly storage: EncryptedCloudLedgerOutboxStorage;
}): EncryptedCloudLedgerOutbox {
  const encryptionKey = copyBytes(input.encryptionKey);
  let mutationQueue: Promise<void> = Promise.resolve();

  const serializeMutation = <Result>(mutation: () => Promise<Result>): Promise<Result> => {
    const run = mutationQueue.catch(() => undefined).then(mutation);
    mutationQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  return {
    clear: () => serializeMutation(() => input.storage.clear()),
    enqueue: (change) =>
      serializeMutation(async () => {
        const changes = [
          ...(await loadOutboxSnapshot(input.storage, encryptionKey)).changes,
          change,
        ];
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: CLOUD_LEDGER_OUTBOX_VERSION,
          changes,
        });
        return changes;
      }),
    load: async () => (await loadOutboxSnapshot(input.storage, encryptionKey)).changes,
    remove: (changeIds) =>
      serializeMutation(async () => {
        const changeIdSet = new Set(changeIds);
        const changes = (await loadOutboxSnapshot(input.storage, encryptionKey)).changes.filter(
          (change) => !changeIdSet.has(change.id)
        );
        if (changes.length === 0) {
          await input.storage.clear();
          return;
        }
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: CLOUD_LEDGER_OUTBOX_VERSION,
          changes,
        });
      }),
  };
}

export function getCloudLedgerOutbox(userId: UserId): EncryptedCloudLedgerOutbox {
  const existing = outboxesByUserId.get(userId);
  if (existing !== undefined) {
    return existing;
  }

  const outbox = createEncryptedCloudLedgerOutbox({
    encryptionKey: getOrCreateOutboxEncryptionKey(userId),
    storage: createSecureStoreCloudLedgerOutboxStorage(userId),
  });
  outboxesByUserId.set(userId, outbox);
  return outbox;
}

export function resetCloudLedgerOutboxInstances(): void {
  outboxesByUserId.clear();
}

export async function discardCloudLedgerOutbox(userId: UserId): Promise<void> {
  await getCloudLedgerOutbox(userId).clear();
  await SecureStore.deleteItemAsync(secureStoreOutboxEncryptionKey(userId));
  outboxesByUserId.delete(userId);
}

export async function hasPendingCloudLedgerOutboxChanges(userId: UserId): Promise<boolean> {
  return (await getCloudLedgerOutbox(userId).load()).length > 0;
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

export async function createOfflineCloudLedgerTransaction(input: {
  readonly cache: CloudLedgerCache;
  readonly changeId: LedgerChangeId;
  readonly command: CloudLedgerCreateTransactionCommand;
  readonly createdAt: IsoDateTime;
  readonly outbox: EncryptedCloudLedgerOutbox;
}): Promise<CloudLedgerCache> {
  const changes = await input.outbox.enqueue({
    id: input.changeId,
    kind: "createTransaction",
    commandVersion: input.command.commandVersion,
    transaction: input.command.transaction,
    createdAt: input.createdAt,
  });
  return applyPendingLedgerChanges(input.cache, changes);
}

export async function restoreOptimisticCloudLedgerCache(input: {
  readonly cache: CloudLedgerCache;
  readonly outbox: EncryptedCloudLedgerOutbox;
}): Promise<CloudLedgerCache> {
  return applyPendingLedgerChanges(input.cache, await input.outbox.load());
}

export async function flushPendingCloudLedgerChanges(input: {
  readonly cache: CloudLedgerCache;
  readonly outbox: EncryptedCloudLedgerOutbox;
  readonly supabase: SupabaseClient;
  readonly shouldContinue?: () => boolean;
}): Promise<CloudLedgerCache> {
  const changes = await input.outbox.load();
  if (input.shouldContinue?.() === false) {
    return applyPendingLedgerChanges(input.cache, changes);
  }
  const acceptedChangeIds = await flushPendingChanges(input.supabase, changes);
  if (input.shouldContinue?.() === false) {
    return applyPendingLedgerChanges(input.cache, changes);
  }
  const refreshedCache = await refreshCloudLedgerCache(input.supabase, input.cache);
  if (input.shouldContinue?.() === false) {
    return applyPendingLedgerChanges(input.cache, changes);
  }
  await input.outbox.remove(acceptedChangeIds);
  return restoreOptimisticCloudLedgerCache({
    cache: refreshedCache,
    outbox: input.outbox,
  });
}

export function applyPendingLedgerChanges(
  cache: CloudLedgerCache,
  changes: readonly CloudLedgerPendingChange[]
): CloudLedgerCache {
  const optimisticTransactions = changes.map(toOptimisticTransaction);
  return {
    ...cache,
    ...withTransactionProjection(upsertTransactions(cache.transactions, optimisticTransactions)),
  };
}

async function flushPendingChanges(
  supabase: SupabaseClient,
  changes: readonly CloudLedgerPendingChange[]
): Promise<readonly LedgerChangeId[]> {
  if (changes.length === 0) {
    return [];
  }
  const outcome = await applyPendingCloudLedgerChanges(supabase, {
    commandVersion: 1,
    changes: changes.map((change) => ({
      id: change.id,
      kind: change.kind,
      commandVersion: change.commandVersion,
      transaction: change.transaction,
    })),
  });
  return outcome.acceptedChangeIds;
}

function toOptimisticTransaction(change: CloudLedgerPendingChange): CloudLedgerTransaction {
  return {
    ...change.transaction,
    updatedAt: change.createdAt,
  };
}

function upsertTransactions(
  existing: readonly CloudLedgerTransaction[],
  incoming: readonly CloudLedgerTransaction[]
): readonly CloudLedgerTransaction[] {
  return [
    ...new Map(
      [...existing, ...incoming].map((transaction) => [transaction.id, transaction])
    ).values(),
  ];
}

async function loadOutboxSnapshot(
  storage: EncryptedCloudLedgerOutboxStorage,
  encryptionKey: Uint8Array
): Promise<CloudLedgerOutboxSnapshot> {
  const encrypted = await storage.read();
  return encrypted === null
    ? { version: CLOUD_LEDGER_OUTBOX_VERSION, changes: [] }
    : await decryptOutboxSnapshot(encrypted, encryptionKey);
}

async function writeOutboxSnapshot(
  storage: EncryptedCloudLedgerOutboxStorage,
  encryptionKey: Uint8Array,
  snapshot: CloudLedgerOutboxSnapshot
): Promise<void> {
  await storage.write(await encryptOutboxSnapshot(snapshot, encryptionKey));
}

async function encryptOutboxSnapshot(
  snapshot: CloudLedgerOutboxSnapshot,
  encryptionKey: Uint8Array
): Promise<EncryptedCloudLedgerOutboxSnapshot> {
  const nonce = randomBytes(GCM_NONCE_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toPlainBufferSource(nonce) },
    await importAesGcmKey(encryptionKey, ["encrypt"]),
    toPlainBufferSource(encodeJson(snapshot))
  );
  return {
    version: CLOUD_LEDGER_OUTBOX_VERSION,
    algorithm: "AES-GCM",
    nonce: toBase64(nonce),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptOutboxSnapshot(
  snapshot: EncryptedCloudLedgerOutboxSnapshot,
  encryptionKey: Uint8Array
): Promise<CloudLedgerOutboxSnapshot> {
  try {
    if (snapshot.version !== CLOUD_LEDGER_OUTBOX_VERSION || snapshot.algorithm !== "AES-GCM") {
      throw new Error("unsupported Cloud Ledger outbox snapshot");
    }
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toPlainBufferSource(fromBase64(snapshot.nonce)) },
      await importAesGcmKey(encryptionKey, ["decrypt"]),
      toPlainBufferSource(fromBase64(snapshot.ciphertext))
    );
    return parseOutboxSnapshot(JSON.parse(decodeUtf8(new Uint8Array(plaintext))));
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
  };
}

function parsePendingChange(value: unknown): CloudLedgerPendingChange {
  const record = requireRecord(value, "pending change");
  if (record.kind !== "createTransaction" || record.commandVersion !== 1) {
    throw new Error("pending change command must be createTransaction v1");
  }
  return {
    id: requireLedgerChangeId(requireString(record.id, "id")),
    kind: "createTransaction",
    commandVersion: 1,
    transaction: parseCreateTransaction(record.transaction),
    createdAt: requireIsoDateTime(requireString(record.createdAt, "createdAt")),
  };
}

function parseCreateTransaction(
  value: unknown
): CloudLedgerCreateTransactionCommand["transaction"] {
  const record = requireRecord(value, "transaction");
  return {
    id: requireTransactionId(requireString(record.id, "transaction.id")),
    type: requireTransactionType(record.type),
    amount: requireCopAmount(requireNumber(record.amount, "transaction.amount")),
    currency: requireCopCurrency(record.currency),
    categoryId: parseCategoryId(record.categoryId),
    accountId: requireFinancialAccountId(requireString(record.accountId, "transaction.accountId")),
    description: parseDescription(record.description),
    date: requireIsoDate(requireString(record.date, "transaction.date")),
  };
}

function parseCategoryId(value: unknown) {
  return value === null ? null : requireCategoryId(requireString(value, "transaction.categoryId"));
}

function parseDescription(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  return requireString(value, "transaction.description");
}

function requireTransactionType(value: unknown): "income" | "expense" {
  if (value === "income" || value === "expense") {
    return value;
  }
  throw new Error("transaction.type must be income or expense");
}

function requireCopCurrency(value: unknown): "COP" {
  if (value === "COP") {
    return "COP";
  }
  throw new Error("transaction.currency must be COP");
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${label} must be an object`);
}

function requireArray(value: unknown, label: string): ReadonlyArray<unknown> {
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

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function importAesGcmKey(rawKey: Uint8Array, usages: ReadonlyArray<KeyUsage>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toPlainBufferSource(rawKey), "AES-GCM", false, [...usages]);
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function toBase64(value: Uint8Array): string {
  return btoa(Array.from(value, (byte) => String.fromCodePoint(byte)).join(""));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.codePointAt(0) ?? 0);
}

function copyBytes(value: Uint8Array): Uint8Array {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

function toPlainBufferSource(value: Uint8Array): BufferSource {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy;
}

function toSecureStoreKeyFragment(value: string): string {
  return encodeURIComponent(value)
    .replaceAll("%", "_")
    .replaceAll(/[^A-Za-z0-9._-]/g, "_");
}

function secureStoreOutboxKey(userId: UserId): string {
  return `cloud-ledger-outbox_${toSecureStoreKeyFragment(userId)}`;
}

function secureStoreOutboxEncryptionKey(userId: UserId): string {
  return `cloud-ledger-outbox-key_${toSecureStoreKeyFragment(userId)}`;
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

function getOrCreateOutboxEncryptionKey(userId: UserId): Uint8Array {
  const key = secureStoreOutboxEncryptionKey(userId);
  const existing = SecureStore.getItem(key);
  if (existing !== null && OUTBOX_KEY_PATTERN.test(existing)) {
    return fromHex(existing);
  }

  const bytes = Crypto.getRandomBytes(OUTBOX_KEY_BYTES);
  SecureStore.setItem(key, toHex(bytes));
  return bytes;
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

function requireNonNegativeInteger(value: unknown, label: string): number {
  const number = requireNumber(value, label);
  if (Number.isInteger(number) && number >= 0) {
    return number;
  }
  throw new Error(`${label} must be a non-negative integer`);
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
}): number {
  return (
    Math.max(input.previousManifest?.generation ?? 0, input.stagedAllocation?.generation ?? 0) + 1
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

async function writeSecureStoreOutboxPayload(key: string, payload: string): Promise<void> {
  const [previousManifest, stagedAllocation] = await Promise.all([
    SecureStore.getItemAsync(key).then(parseChunkedOutboxManifest),
    SecureStore.getItemAsync(secureStoreOutboxStagedKey(key)).then(parseStagedChunkAllocation),
  ]);
  const chunks = chunkString(payload);
  const activeAllocation = {
    generation: nextSecureStoreOutboxGeneration({ previousManifest, stagedAllocation }),
    chunkCount: chunks.length,
  } satisfies SecureStoreOutboxChunkAllocation;
  const allocatedGenerations = mergeChunkAllocations([
    activeAllocation,
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

async function clearSecureStoreOutboxPayload(key: string): Promise<void> {
  const [manifest, stagedAllocation] = await Promise.all([
    SecureStore.getItemAsync(key).then(parseChunkedOutboxManifest),
    SecureStore.getItemAsync(secureStoreOutboxStagedKey(key)).then(parseStagedChunkAllocation),
  ]);
  const allocations = mergeChunkAllocations([
    ...(manifest?.allocatedGenerations ?? []),
    ...(stagedAllocation === null ? [] : [stagedAllocation]),
  ]);
  await Promise.all([
    SecureStore.deleteItemAsync(key),
    SecureStore.deleteItemAsync(secureStoreOutboxStagedKey(key)),
    ...allocations.flatMap((allocation) =>
      secureStoreOutboxChunkKeys(key, allocation).map((chunkKey) =>
        SecureStore.deleteItemAsync(chunkKey)
      )
    ),
  ]);
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

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  return Uint8Array.from(value.match(/.{1,2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}
