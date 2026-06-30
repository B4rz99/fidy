import type { SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { requireLedgerChangeId } from "@/shared/types/assertions";
import type { IsoDateTime, LedgerChangeId, TransactionId, UserId } from "@/shared/types/branded";
import {
  applyPendingCloudLedgerChanges,
  CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT,
  type CloudLedgerApplyPendingChangesAccepted,
  type CloudLedgerPendingChangeOutcome,
} from "./api-client";
import {
  refreshCloudLedgerCache,
  type CloudLedgerCache,
  type CloudLedgerCreateTransactionCommand,
  type CloudLedgerTransaction,
} from "./cache";
import * as outboxReconciliation from "./outbox-reconciliation";
import {
  applyPendingLedgerChanges,
  parsePendingChange,
  toPendingChangeCommand,
  toTransactionCommandPayload,
  withPendingChangeDependencies,
  type CloudLedgerPendingChange,
} from "./pending-changes";
export { applyPendingLedgerChanges } from "./pending-changes";
export type {
  CloudLedgerPendingAmendTransaction,
  CloudLedgerPendingChange,
  CloudLedgerPendingCreateTransaction,
  CloudLedgerPendingDeleteTransaction,
} from "./pending-changes";

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
  readonly clearRepairStates?: (changeIds: readonly LedgerChangeId[]) => Promise<void>;
  readonly load: () => Promise<readonly CloudLedgerPendingChange[]>;
  readonly loadAutoRetryAttempts?: () => Promise<readonly CloudLedgerAutoRetryState[]>;
  readonly loadRepairItems?: () => Promise<readonly CloudLedgerRepairItem[]>;
  readonly enqueue: (
    change: CloudLedgerPendingChange
  ) => Promise<readonly CloudLedgerPendingChange[]>;
  readonly recordAutoRetryAttempts?: (items: readonly CloudLedgerAutoRetryState[]) => Promise<void>;
  readonly markForRepair?: (items: readonly CloudLedgerRepairState[]) => Promise<void>;
  readonly remove: (changeIds: readonly LedgerChangeId[]) => Promise<void>;
  readonly removeAcceptedChanges?: (
    changesToRemove: readonly CloudLedgerPendingChange[]
  ) => Promise<void>;
  readonly replace?: (
    change: CloudLedgerPendingChange
  ) => Promise<readonly CloudLedgerPendingChange[]>;
  readonly clear: () => Promise<void>;
};

export type CloudLedgerOutboxFailureCode = "invalid_encrypted_outbox";

export type CloudLedgerRepairAction = "discard" | "editAndResubmit" | "retry";
export type CloudLedgerRepairReason =
  | "dependencyFailure"
  | "duplicateChange"
  | "invalidTransaction"
  | "retryableFailure"
  | "staleConflict"
  | "unauthorizedTransaction"
  | "unresolvedFailure"
  | "unsupportedCommandVersion";
export type CloudLedgerRepairState = {
  readonly changeId: LedgerChangeId;
  readonly outcome: CloudLedgerPendingChangeOutcome;
  readonly parentChangeId?: LedgerChangeId;
};
export type CloudLedgerAutoRetryState = {
  readonly changeId: LedgerChangeId;
  readonly attempts: number;
};
export type CloudLedgerRepairItem = {
  readonly id: LedgerChangeId;
  readonly kind: CloudLedgerPendingChange["kind"];
  readonly change: CloudLedgerPendingChange;
  readonly outcome: CloudLedgerPendingChangeOutcome;
  readonly parentChangeId?: LedgerChangeId;
  readonly reason: CloudLedgerRepairReason;
  readonly actions: readonly CloudLedgerRepairAction[];
};

type CloudLedgerOutboxSnapshot = {
  readonly version: typeof CLOUD_LEDGER_OUTBOX_VERSION;
  readonly changes: readonly CloudLedgerPendingChange[];
  readonly retryAttempts: readonly CloudLedgerAutoRetryState[];
  readonly repairs: readonly CloudLedgerRepairState[];
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
const GCM_TAG_BYTES = 16;
const OUTBOX_KEY_BYTES = 32;
const OUTBOX_KEY_PATTERN = /^[0-9a-f]{64}$/;
const SECURE_STORE_OUTBOX_CHUNK_SIZE = 1500;
const CHUNKED_SECURE_STORE_OUTBOX_STORAGE = "chunked-secure-store";
const CLOUD_LEDGER_DEVICE_ID_BYTES = 16;
const CLOUD_LEDGER_DEVICE_ID_KEY = "cloud-ledger-device-id";
const CLOUD_LEDGER_DEVICE_ID_PATTERN = /^device-[0-9a-f]{32}$/;
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
    clearRepairStates: (changeIds) =>
      serializeMutation(async () => {
        const changeIdSet = new Set(changeIds);
        const snapshot = await loadOutboxSnapshot(input.storage, encryptionKey);
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: CLOUD_LEDGER_OUTBOX_VERSION,
          changes: snapshot.changes,
          retryAttempts: snapshot.retryAttempts.filter((retry) => !changeIdSet.has(retry.changeId)),
          repairs: snapshot.repairs.filter((repair) => !changeIdSet.has(repair.changeId)),
        });
      }),
    enqueue: (change) =>
      serializeMutation(async () => {
        const snapshot = await loadOutboxSnapshot(input.storage, encryptionKey);
        const changeWithDependencies = withPendingChangeDependencies(change, snapshot.changes);
        const changes = [...snapshot.changes, changeWithDependencies];
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: CLOUD_LEDGER_OUTBOX_VERSION,
          changes,
          retryAttempts: snapshot.retryAttempts.filter((retry) => retry.changeId !== change.id),
          repairs: snapshot.repairs.filter((repair) => repair.changeId !== change.id),
        });
        return changes;
      }),
    load: async () => (await loadOutboxSnapshot(input.storage, encryptionKey)).changes,
    loadAutoRetryAttempts: async () =>
      (await loadOutboxSnapshot(input.storage, encryptionKey)).retryAttempts,
    loadRepairItems: async () =>
      repairItemsFromSnapshot(await loadOutboxSnapshot(input.storage, encryptionKey)),
    recordAutoRetryAttempts: (items) =>
      serializeMutation(async () => {
        if (items.length === 0) return;
        const snapshot = await loadOutboxSnapshot(input.storage, encryptionKey);
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: CLOUD_LEDGER_OUTBOX_VERSION,
          changes: snapshot.changes,
          retryAttempts: mergeAutoRetryStates(snapshot.retryAttempts, items),
          repairs: snapshot.repairs,
        });
      }),
    markForRepair: (items) =>
      serializeMutation(async () => {
        if (items.length === 0) return;
        const snapshot = await loadOutboxSnapshot(input.storage, encryptionKey);
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: CLOUD_LEDGER_OUTBOX_VERSION,
          changes: snapshot.changes,
          retryAttempts: snapshot.retryAttempts,
          repairs: mergeRepairStates(snapshot.repairs, items),
        });
      }),
    remove: (changeIds) =>
      serializeMutation(async () => {
        const changeIdSet = new Set(changeIds);
        const snapshot = await loadOutboxSnapshot(input.storage, encryptionKey);
        const changes = snapshot.changes.filter((change) => !changeIdSet.has(change.id));
        const repairs = snapshot.repairs.filter((repair) => !changeIdSet.has(repair.changeId));
        if (changes.length === 0) {
          await input.storage.clear();
          return;
        }
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: CLOUD_LEDGER_OUTBOX_VERSION,
          changes,
          retryAttempts: snapshot.retryAttempts.filter((retry) => !changeIdSet.has(retry.changeId)),
          repairs,
        });
      }),
    removeAcceptedChanges: (changesToRemove) =>
      serializeMutation(async () => {
        const snapshot = await loadOutboxSnapshot(input.storage, encryptionKey);
        const changes = outboxReconciliation.removePendingChangeOccurrences(
          snapshot.changes,
          changesToRemove
        );
        const removedChangeIds = new Set(changesToRemove.map((change) => change.id));
        const repairs = snapshot.repairs.filter((repair) => !removedChangeIds.has(repair.changeId));
        if (changes.length === 0) {
          await input.storage.clear();
          return;
        }
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: CLOUD_LEDGER_OUTBOX_VERSION,
          changes,
          retryAttempts: snapshot.retryAttempts.filter(
            (retry) => !removedChangeIds.has(retry.changeId)
          ),
          repairs,
        });
      }),
    replace: (change) =>
      serializeMutation(async () => {
        const snapshot = await loadOutboxSnapshot(input.storage, encryptionKey);
        const changes = snapshot.changes.some((candidate) => candidate.id === change.id)
          ? snapshot.changes.map((candidate) => (candidate.id === change.id ? change : candidate))
          : [...snapshot.changes, change];
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: CLOUD_LEDGER_OUTBOX_VERSION,
          changes,
          retryAttempts: snapshot.retryAttempts.filter((retry) => retry.changeId !== change.id),
          repairs: snapshot.repairs.filter((repair) => repair.changeId !== change.id),
        });
        return changes;
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
  const outbox = outboxesByUserId.get(userId);
  const payloadKey = secureStoreOutboxKey(userId);
  const encryptionKeyName = secureStoreOutboxEncryptionKey(userId);
  const encryptionKey = SecureStore.getItem(encryptionKeyName);
  try {
    await SecureStore.deleteItemAsync(encryptionKeyName);
    await (outbox?.clear() ?? clearSecureStoreOutboxPayload(payloadKey));
    outboxesByUserId.delete(userId);
  } catch (error) {
    if (encryptionKey !== null) {
      SecureStore.setItem(encryptionKeyName, encryptionKey);
    }
    throw error;
  }
}

export async function hasPendingCloudLedgerOutboxChanges(userId: UserId): Promise<boolean> {
  const existing = outboxesByUserId.get(userId);
  if (existing !== undefined) {
    return (await existing.load()).length > 0;
  }

  const encryptionKey = getExistingOutboxEncryptionKey(userId);
  if (encryptionKey === null) {
    return false;
  }
  const outbox = createEncryptedCloudLedgerOutbox({
    encryptionKey,
    storage: createSecureStoreCloudLedgerOutboxStorage(userId),
  });
  outboxesByUserId.set(userId, outbox);
  return (await outbox.load()).length > 0;
}

export async function loadCloudLedgerRepairItems(
  outbox: EncryptedCloudLedgerOutbox
): Promise<readonly CloudLedgerRepairItem[]> {
  return outbox.loadRepairItems?.() ?? [];
}

export async function retryCloudLedgerRepairItem(
  outbox: EncryptedCloudLedgerOutbox,
  changeId: LedgerChangeId
): Promise<void> {
  await outbox.clearRepairStates?.([changeId]);
}

export async function discardCloudLedgerRepairItem(
  outbox: EncryptedCloudLedgerOutbox,
  changeId: LedgerChangeId
): Promise<void> {
  await outbox.remove([changeId]);
}

export async function retryCloudLedgerRepairSet(outbox: EncryptedCloudLedgerOutbox): Promise<void> {
  await outbox.clearRepairStates?.(
    (await loadCloudLedgerRepairItems(outbox)).map((item) => item.id)
  );
}

export async function resubmitCloudLedgerRepairTransactionChange(input: {
  readonly cache: CloudLedgerCache;
  readonly changeId: LedgerChangeId;
  readonly createdAt: IsoDateTime;
  readonly expectedVersion?: number;
  readonly outbox: EncryptedCloudLedgerOutbox;
  readonly transaction: CloudLedgerTransaction;
}): Promise<CloudLedgerCache> {
  const repairItem = (await loadCloudLedgerRepairItems(input.outbox)).find(
    (item) => item.id === input.changeId
  );
  if (repairItem === undefined) {
    throw new Error("pending change repair item must exist before resubmitting");
  }
  const replacement = resubmittedTransactionChange(repairItem.change, input);
  const changes =
    input.outbox.replace === undefined
      ? await replacePendingChangeThroughOutboxFallback(input.outbox, replacement)
      : await input.outbox.replace(replacement);
  return applyPendingLedgerChanges(input.cache, changes);
}

function resubmittedTransactionChange(
  change: CloudLedgerPendingChange,
  input: {
    readonly createdAt: IsoDateTime;
    readonly expectedVersion?: number;
    readonly transaction: CloudLedgerTransaction;
  }
): CloudLedgerPendingChange {
  if (change.kind === "createTransaction") {
    return {
      ...change,
      createdAt: input.createdAt,
      transaction: toTransactionCommandPayload(input.transaction),
    };
  }
  if (change.kind === "amendTransaction") {
    return {
      ...change,
      createdAt: input.createdAt,
      expectedVersion: requireResubmitExpectedVersion(input.expectedVersion),
      transaction: toTransactionCommandPayload(input.transaction),
    };
  }
  throw new Error("delete transaction repairs cannot be edited and resubmitted");
}

function requireResubmitExpectedVersion(value: number | undefined): number {
  if (value !== undefined && Number.isInteger(value) && value > 0) {
    return value;
  }
  throw new Error("expectedVersion is required when resubmitting an amend repair");
}

async function replacePendingChangeThroughOutboxFallback(
  outbox: EncryptedCloudLedgerOutbox,
  change: CloudLedgerPendingChange
): Promise<readonly CloudLedgerPendingChange[]> {
  await outbox.remove([change.id]);
  return await outbox.enqueue(change);
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

export async function amendOfflineCloudLedgerTransaction(input: {
  readonly cache: CloudLedgerCache;
  readonly changeId: LedgerChangeId;
  readonly createdAt: IsoDateTime;
  readonly expectedVersion: number;
  readonly outbox: EncryptedCloudLedgerOutbox;
  readonly transaction: CloudLedgerTransaction;
}): Promise<CloudLedgerCache> {
  const changes = await input.outbox.enqueue({
    id: input.changeId,
    kind: "amendTransaction",
    commandVersion: 1,
    transaction: toTransactionCommandPayload(input.transaction),
    expectedVersion: input.expectedVersion,
    createdAt: input.createdAt,
  });
  return applyPendingLedgerChanges(input.cache, changes);
}

export async function deleteOfflineCloudLedgerTransaction(input: {
  readonly cache: CloudLedgerCache;
  readonly changeId: LedgerChangeId;
  readonly createdAt: IsoDateTime;
  readonly expectedVersion: number;
  readonly outbox: EncryptedCloudLedgerOutbox;
  readonly transactionId: TransactionId;
}): Promise<CloudLedgerCache> {
  const changes = await input.outbox.enqueue({
    id: input.changeId,
    kind: "deleteTransaction",
    commandVersion: 1,
    transactionId: input.transactionId,
    expectedVersion: input.expectedVersion,
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
  readonly abortSignal?: AbortSignal;
  readonly cache: CloudLedgerCache;
  readonly outbox: EncryptedCloudLedgerOutbox;
  readonly supabase: SupabaseClient;
  readonly shouldContinue?: () => boolean;
}): Promise<CloudLedgerCache> {
  const changes = await input.outbox.load();
  const repairChangeIds = dependencyBlockedChangeIds(
    changes,
    new Set((await loadCloudLedgerRepairItems(input.outbox)).map((item) => item.id))
  );
  const retryAttempts = new Map(
    (await (input.outbox.loadAutoRetryAttempts?.() ?? Promise.resolve([]))).map((retry) => [
      retry.changeId,
      retry.attempts,
    ])
  );
  const flushableChanges = changes.filter((change) => !repairChangeIds.has(change.id));
  if (input.shouldContinue?.() === false) {
    return applyPendingLedgerChanges(input.cache, changes);
  }
  if (flushableChanges.length === 0) {
    return applyPendingLedgerChanges(input.cache, changes);
  }
  const { repairStates, retryStates, removableChanges } = await flushPendingChanges(
    input.supabase,
    flushableChanges,
    retryAttempts,
    input.abortSignal,
    input.shouldContinue
  );
  if (input.shouldContinue?.() === false) {
    return applyPendingLedgerChanges(input.cache, changes);
  }
  const refreshedCache = await refreshCloudLedgerCache(input.supabase, input.cache);
  if (input.shouldContinue?.() === false) {
    return applyPendingLedgerChanges(input.cache, changes);
  }
  if (input.outbox.removeAcceptedChanges === undefined) {
    await input.outbox.remove(removableChanges.map((change) => change.id));
  } else {
    await input.outbox.removeAcceptedChanges(removableChanges);
  }
  await input.outbox.recordAutoRetryAttempts?.(retryStates);
  await input.outbox.markForRepair?.(repairStates);
  return restoreOptimisticCloudLedgerCache({
    cache: refreshedCache,
    outbox: input.outbox,
  });
}

function dependencyBlockedChangeIds(
  changes: readonly CloudLedgerPendingChange[],
  blockedIds: ReadonlySet<LedgerChangeId>
): ReadonlySet<LedgerChangeId> {
  const nextBlockedIds = new Set([
    ...blockedIds,
    ...changes
      .filter((change) => !blockedIds.has(change.id))
      .filter((change) =>
        (change.dependencies ?? []).some((dependency) => blockedIds.has(dependency))
      )
      .map((change) => change.id),
  ]);
  return nextBlockedIds.size === blockedIds.size
    ? blockedIds
    : dependencyBlockedChangeIds(changes, nextBlockedIds);
}

async function flushPendingChanges(
  supabase: SupabaseClient,
  changes: readonly CloudLedgerPendingChange[],
  retryAttempts: ReadonlyMap<LedgerChangeId, number>,
  abortSignal?: AbortSignal,
  shouldContinue?: () => boolean
): Promise<{
  readonly removableChanges: readonly CloudLedgerPendingChange[];
  readonly repairStates: readonly CloudLedgerRepairState[];
  readonly retryStates: readonly CloudLedgerAutoRetryState[];
}> {
  if (changes.length === 0) {
    return { removableChanges: [], repairStates: [], retryStates: [] };
  }
  const deviceId = getOrCreateCloudLedgerDeviceId();
  return await chunkPendingChanges(changes).reduce<
    Promise<{
      readonly removableChanges: readonly CloudLedgerPendingChange[];
      readonly repairStates: readonly CloudLedgerRepairState[];
      readonly retryStates: readonly CloudLedgerAutoRetryState[];
    }>
  >(
    async (previous, batch) => {
      const progress = await previous;
      if (shouldContinue?.() === false) {
        return progress;
      }
      const outcome = await applyPendingCloudLedgerChanges(
        supabase,
        {
          commandVersion: 1,
          deviceId,
          batchId: pendingChangeBatchId(batch),
          changes: batch.map(toPendingChangeCommand),
        },
        { signal: abortSignal }
      );
      return {
        removableChanges: removablePendingChanges(progress.removableChanges, batch, outcome),
        repairStates: [
          ...progress.repairStates,
          ...repairStatesFromOutcome(batch, outcome, retryAttempts),
        ],
        retryStates: [
          ...progress.retryStates,
          ...retryStatesFromOutcome(batch, outcome, retryAttempts),
        ],
      };
    },
    Promise.resolve({ removableChanges: [], repairStates: [], retryStates: [] })
  );
}

function repairStatesFromOutcome(
  batch: readonly CloudLedgerPendingChange[],
  outcome: CloudLedgerApplyPendingChangesAccepted,
  retryAttempts: ReadonlyMap<LedgerChangeId, number>
): readonly CloudLedgerRepairState[] {
  if (outcome.changeOutcomes.length === 0) {
    return [];
  }
  const changesById = new Set(batch.map((change) => change.id));
  const batchOutcomes = outcome.changeOutcomes.filter((changeOutcome) =>
    changesById.has(changeOutcome.changeId)
  );
  return batchOutcomes
    .filter((changeOutcome) => shouldSurfaceRepairOutcome(changeOutcome, retryAttempts))
    .map((changeOutcome) =>
      repairStateFromOutcome(batch, batchOutcomes, changeOutcome, retryAttempts)
    );
}

function repairStateFromOutcome(
  batch: readonly CloudLedgerPendingChange[],
  batchOutcomes: readonly CloudLedgerPendingChangeOutcome[],
  outcome: CloudLedgerPendingChangeOutcome,
  retryAttempts: ReadonlyMap<LedgerChangeId, number>
): CloudLedgerRepairState {
  const parentChangeId = parentProblemChangeId(batch, batchOutcomes, outcome, retryAttempts);
  return parentChangeId === undefined
    ? { changeId: outcome.changeId, outcome }
    : { changeId: outcome.changeId, outcome, parentChangeId };
}

function parentProblemChangeId(
  batch: readonly CloudLedgerPendingChange[],
  batchOutcomes: readonly CloudLedgerPendingChangeOutcome[],
  outcome: CloudLedgerPendingChangeOutcome,
  retryAttempts: ReadonlyMap<LedgerChangeId, number>
): LedgerChangeId | undefined {
  if (outcome.code !== "dependency_failed") {
    return undefined;
  }
  const dependencies = batch.find((change) => change.id === outcome.changeId)?.dependencies ?? [];
  const surfacedParentIds = new Set(
    batchOutcomes
      .filter((candidate) => candidate.changeId !== outcome.changeId)
      .filter((candidate) => shouldSurfaceRepairOutcome(candidate, retryAttempts))
      .map((candidate) => candidate.changeId)
  );
  return dependencies.find((dependency) => surfacedParentIds.has(dependency)) ?? dependencies[0];
}

function shouldSurfaceRepairOutcome(
  outcome: CloudLedgerPendingChangeOutcome,
  retryAttempts: ReadonlyMap<LedgerChangeId, number>
): boolean {
  if (outcome.status === "retryable") {
    return (retryAttempts.get(outcome.changeId) ?? 0) > 0;
  }
  return outcome.status === "repair_required" || outcome.status === "requires_app_update";
}

function retryStatesFromOutcome(
  batch: readonly CloudLedgerPendingChange[],
  outcome: CloudLedgerApplyPendingChangesAccepted,
  retryAttempts: ReadonlyMap<LedgerChangeId, number>
): readonly CloudLedgerAutoRetryState[] {
  if (outcome.changeOutcomes.length === 0) {
    return [];
  }
  const changesById = new Set(batch.map((change) => change.id));
  return outcome.changeOutcomes
    .filter(
      (changeOutcome) =>
        changesById.has(changeOutcome.changeId) &&
        changeOutcome.status === "retryable" &&
        (retryAttempts.get(changeOutcome.changeId) ?? 0) === 0
    )
    .map((changeOutcome) => ({
      changeId: changeOutcome.changeId,
      attempts: 1,
    }));
}

function repairItemsFromSnapshot(
  snapshot: CloudLedgerOutboxSnapshot
): readonly CloudLedgerRepairItem[] {
  const changesById = new Map(snapshot.changes.map((change) => [change.id, change]));
  return snapshot.repairs.flatMap((repair) => {
    const change = changesById.get(repair.changeId);
    const presentation = change === undefined ? null : repairPresentation(change, repair.outcome);
    return change === undefined || presentation === null
      ? []
      : [
          {
            id: repair.changeId,
            kind: change.kind,
            change,
            outcome: repair.outcome,
            ...(repair.parentChangeId === undefined
              ? {}
              : { parentChangeId: repair.parentChangeId }),
            ...presentation,
          },
        ];
  });
}

function repairPresentation(
  change: CloudLedgerPendingChange,
  outcome: CloudLedgerPendingChangeOutcome
): Pick<CloudLedgerRepairItem, "actions" | "reason"> | null {
  if (outcome.status === "retryable") {
    return { reason: "retryableFailure", actions: ["retry", "discard"] };
  }
  if (outcome.status === "requires_app_update" || outcome.code === "unsupported_command_version") {
    return { reason: "unsupportedCommandVersion", actions: ["discard"] };
  }
  if (outcome.code === "stale_expected_version") {
    return { reason: "staleConflict", actions: editableRepairActions(change) };
  }
  if (outcome.code === "dependency_failed") {
    return { reason: "dependencyFailure", actions: ["discard"] };
  }
  if (
    outcome.code === "duplicate_change_id" ||
    outcome.code === "duplicate_idempotency_key" ||
    outcome.code === "duplicate_transaction_id"
  ) {
    return { reason: "duplicateChange", actions: ["discard"] };
  }
  if (outcome.code === "unauthorized_transaction_id") {
    return { reason: "unauthorizedTransaction", actions: ["discard"] };
  }
  if (
    outcome.code === "invalid_ledger_reference" ||
    outcome.code === "invalid_transaction" ||
    outcome.code === "invalid_transaction_id"
  ) {
    return { reason: "invalidTransaction", actions: editableRepairActions(change) };
  }
  if (outcome.status === "repair_required") {
    return { reason: "unresolvedFailure", actions: ["discard"] };
  }
  return null;
}

function editableRepairActions(
  change: CloudLedgerPendingChange
): readonly CloudLedgerRepairAction[] {
  return change.kind === "deleteTransaction" ? ["discard"] : ["editAndResubmit", "discard"];
}

function mergeRepairStates(
  existing: readonly CloudLedgerRepairState[],
  incoming: readonly CloudLedgerRepairState[]
): readonly CloudLedgerRepairState[] {
  const incomingIds = new Set(incoming.map((repair) => repair.changeId));
  return [...existing.filter((repair) => !incomingIds.has(repair.changeId)), ...incoming];
}

function mergeAutoRetryStates(
  existing: readonly CloudLedgerAutoRetryState[],
  incoming: readonly CloudLedgerAutoRetryState[]
): readonly CloudLedgerAutoRetryState[] {
  const incomingIds = new Set(incoming.map((retry) => retry.changeId));
  return [...existing.filter((retry) => !incomingIds.has(retry.changeId)), ...incoming];
}

const chunkPendingChanges = (
  changes: readonly CloudLedgerPendingChange[]
): readonly (readonly CloudLedgerPendingChange[])[] =>
  Array.from(
    { length: Math.ceil(changes.length / CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT) },
    (_, index) =>
      changes.slice(
        index * CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT,
        (index + 1) * CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT
      )
  );

function pendingChangeBatchId(batch: readonly CloudLedgerPendingChange[]): string {
  return `batch-${batch[0]?.id ?? "empty"}`;
}

function getOrCreateCloudLedgerDeviceId(): string {
  const existing = SecureStore.getItem(CLOUD_LEDGER_DEVICE_ID_KEY);
  if (existing !== null && CLOUD_LEDGER_DEVICE_ID_PATTERN.test(existing)) {
    return existing;
  }

  const deviceId = `device-${toHex(Crypto.getRandomBytes(CLOUD_LEDGER_DEVICE_ID_BYTES))}`;
  SecureStore.setItem(CLOUD_LEDGER_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

async function loadOutboxSnapshot(
  storage: EncryptedCloudLedgerOutboxStorage,
  encryptionKey: Uint8Array
): Promise<CloudLedgerOutboxSnapshot> {
  const encrypted = await storage.read();
  return encrypted === null
    ? { version: CLOUD_LEDGER_OUTBOX_VERSION, changes: [], retryAttempts: [], repairs: [] }
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

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function copyBytes(value: Uint8Array): Uint8Array {
  const copy = new Uint8Array(value.byteLength);
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

function getExistingOutboxEncryptionKey(userId: UserId): Uint8Array | null {
  const existing = SecureStore.getItem(secureStoreOutboxEncryptionKey(userId));
  return existing !== null && OUTBOX_KEY_PATTERN.test(existing) ? fromHex(existing) : null;
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

async function clearSecureStoreOutboxPayload(key: string): Promise<void> {
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

function removablePendingChanges(
  previousChanges: readonly CloudLedgerPendingChange[],
  batch: readonly CloudLedgerPendingChange[],
  outcome: Parameters<typeof outboxReconciliation.acceptedPendingChanges>[1]
): readonly CloudLedgerPendingChange[] {
  return [...previousChanges, ...outboxReconciliation.acceptedPendingChanges(batch, outcome)];
}
