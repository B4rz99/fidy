import type { SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { IsoDateTime, LedgerChangeId, TransactionId, UserId } from "@/shared/types/branded";
import {
  applyPendingCloudLedgerChanges,
  CLOUD_LEDGER_PENDING_CHANGE_BATCH_LIMIT,
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
  toPendingChangeCommand,
  toTransactionCommandPayload,
  withPendingChangeDependencies,
  type CloudLedgerPendingChange,
} from "./pending-changes";
import {
  clearSecureStoreOutboxPayload,
  createSecureStoreCloudLedgerOutboxStorage,
  getExistingOutboxEncryptionKey,
  getOrCreateOutboxEncryptionKey,
  loadOutboxSnapshot,
  secureStoreOutboxEncryptionKey,
  secureStoreOutboxKey,
  writeOutboxSnapshot,
  type EncryptedCloudLedgerOutboxStorage,
} from "./outbox-storage";
import {
  dependencyBlockedChangeIds,
  dependentChangeClosureIds,
  mergeAutoRetryStates,
  mergeRepairStates,
  repairItemsFromSnapshot,
  repairStatesFromOutcome,
  repairStatesWithAcceptedTransactionVersions,
  retryStatesFromOutcome,
  type CloudLedgerAutoRetryState,
  type CloudLedgerRepairItem,
  type CloudLedgerRepairState,
} from "./repair-policy";
export { applyPendingLedgerChanges } from "./pending-changes";
export type {
  CloudLedgerPendingAmendTransaction,
  CloudLedgerPendingChange,
  CloudLedgerPendingCreateTransaction,
  CloudLedgerPendingDeleteTransaction,
} from "./pending-changes";
export type {
  CloudLedgerAutoRetryState,
  CloudLedgerRepairAction,
  CloudLedgerRepairItem,
  CloudLedgerRepairReason,
  CloudLedgerRepairState,
} from "./repair-policy";
export {
  CloudLedgerOutboxFailure,
  createSecureStoreCloudLedgerOutboxStorage,
} from "./outbox-storage";
export type {
  CloudLedgerOutboxFailureCode,
  EncryptedCloudLedgerOutboxSnapshot,
  EncryptedCloudLedgerOutboxStorage,
} from "./outbox-storage";

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

const CLOUD_LEDGER_DEVICE_ID_BYTES = 16;
const CLOUD_LEDGER_DEVICE_ID_KEY = "cloud-ledger-device-id";
const CLOUD_LEDGER_DEVICE_ID_PATTERN = /^device-[0-9a-f]{32}$/;
const outboxesByUserId = new Map<string, EncryptedCloudLedgerOutbox>();

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
          version: 1,
          changes: snapshot.changes,
          retryAttempts: snapshot.retryAttempts,
          repairs: snapshot.repairs.filter((repair) => !changeIdSet.has(repair.changeId)),
        });
      }),
    enqueue: (change) =>
      serializeMutation(async () => {
        const snapshot = await loadOutboxSnapshot(input.storage, encryptionKey);
        const changeWithDependencies = withPendingChangeDependencies(change, snapshot.changes);
        const changes = [...snapshot.changes, changeWithDependencies];
        await writeOutboxSnapshot(input.storage, encryptionKey, {
          version: 1,
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
          version: 1,
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
          version: 1,
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
          version: 1,
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
          version: 1,
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
          version: 1,
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
  await outbox.remove([...dependentChangeClosureIds(await outbox.load(), new Set([changeId]))]);
}

export async function retryCloudLedgerRepairSet(outbox: EncryptedCloudLedgerOutbox): Promise<void> {
  await outbox.clearRepairStates?.(
    (await loadCloudLedgerRepairItems(outbox))
      .filter((item) => item.actions.includes("retry"))
      .map((item) => item.id)
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
  await clearDependencyRepairsResolvedByAcceptedChanges(input.outbox, removableChanges);
  await input.outbox.recordAutoRetryAttempts?.(retryStates);
  await input.outbox.markForRepair?.(
    repairStatesWithAcceptedTransactionVersions(repairStates, flushableChanges, refreshedCache)
  );
  return restoreOptimisticCloudLedgerCache({
    cache: refreshedCache,
    outbox: input.outbox,
  });
}

async function clearDependencyRepairsResolvedByAcceptedChanges(
  outbox: EncryptedCloudLedgerOutbox,
  acceptedChanges: readonly CloudLedgerPendingChange[]
): Promise<void> {
  if (outbox.clearRepairStates === undefined || acceptedChanges.length === 0) {
    return;
  }
  const acceptedChangeIds = new Set(acceptedChanges.map((change) => change.id));
  const resolvedDependencyRepairIds = (await loadCloudLedgerRepairItems(outbox))
    .filter((item) => item.reason === "dependencyFailure")
    .filter(
      (item) => item.parentChangeId !== undefined && acceptedChangeIds.has(item.parentChangeId)
    )
    .map((item) => item.id);
  if (resolvedDependencyRepairIds.length === 0) {
    return;
  }
  await outbox.clearRepairStates(resolvedDependencyRepairIds);
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
          ...repairStatesFromOutcome(batch, outcome, retryAttempts, progress.repairStates),
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

function copyBytes(value: Uint8Array): Uint8Array {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function removablePendingChanges(
  previousChanges: readonly CloudLedgerPendingChange[],
  batch: readonly CloudLedgerPendingChange[],
  outcome: Parameters<typeof outboxReconciliation.acceptedPendingChanges>[1]
): readonly CloudLedgerPendingChange[] {
  return [...previousChanges, ...outboxReconciliation.acceptedPendingChanges(batch, outcome)];
}
