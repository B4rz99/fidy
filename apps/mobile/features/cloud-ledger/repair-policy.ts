import type { LedgerChangeId } from "@/shared/types/branded";
import type {
  CloudLedgerApplyPendingChangesAccepted,
  CloudLedgerPendingChangeOutcome,
} from "./api-client";
import type { CloudLedgerCache } from "./cache";
import type { CloudLedgerPendingChange } from "./pending-changes";

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
  readonly acceptedTransactionVersion?: number;
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
  readonly acceptedTransactionVersion?: number;
  readonly parentChangeId?: LedgerChangeId;
  readonly reason: CloudLedgerRepairReason;
  readonly actions: readonly CloudLedgerRepairAction[];
};

export function dependencyBlockedChangeIds(
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

export function dependentChangeClosureIds(
  changes: readonly CloudLedgerPendingChange[],
  rootIds: ReadonlySet<LedgerChangeId>
): ReadonlySet<LedgerChangeId> {
  const nextRootIds = new Set([
    ...rootIds,
    ...changes
      .filter((change) => !rootIds.has(change.id))
      .filter((change) => (change.dependencies ?? []).some((dependency) => rootIds.has(dependency)))
      .map((change) => change.id),
  ]);
  return nextRootIds.size === rootIds.size
    ? rootIds
    : dependentChangeClosureIds(changes, nextRootIds);
}

export function repairStatesWithAcceptedTransactionVersions(
  repairs: readonly CloudLedgerRepairState[],
  changes: readonly CloudLedgerPendingChange[],
  cache: CloudLedgerCache
): readonly CloudLedgerRepairState[] {
  const changesById = new Map(changes.map((change) => [change.id, change]));
  const versionsByTransactionId = new Map(
    cache.transactions.map((transaction) => [transaction.id, transaction.version])
  );
  return repairs.map((repair) => {
    const change = changesById.get(repair.changeId);
    const transactionId =
      change?.kind === "deleteTransaction" ? change.transactionId : change?.transaction.id;
    const acceptedTransactionVersion =
      transactionId === undefined ? undefined : versionsByTransactionId.get(transactionId);
    return acceptedTransactionVersion === undefined
      ? repair
      : { ...repair, acceptedTransactionVersion };
  });
}

export function repairStatesFromOutcome(
  batch: readonly CloudLedgerPendingChange[],
  outcome: CloudLedgerApplyPendingChangesAccepted,
  retryAttempts: ReadonlyMap<LedgerChangeId, number>,
  previousRepairStates: readonly CloudLedgerRepairState[]
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
      repairStateFromOutcome(
        batch,
        batchOutcomes,
        changeOutcome,
        retryAttempts,
        previousRepairStates
      )
    );
}

export function retryStatesFromOutcome(
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

export function repairItemsFromSnapshot(snapshot: {
  readonly changes: readonly CloudLedgerPendingChange[];
  readonly repairs: readonly CloudLedgerRepairState[];
}): readonly CloudLedgerRepairItem[] {
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
            ...(repair.acceptedTransactionVersion === undefined
              ? {}
              : { acceptedTransactionVersion: repair.acceptedTransactionVersion }),
            ...(repair.parentChangeId === undefined
              ? {}
              : { parentChangeId: repair.parentChangeId }),
            ...presentation,
          },
        ];
  });
}

export function repairStateFromRepairItem(item: CloudLedgerRepairItem): CloudLedgerRepairState {
  return {
    changeId: item.id,
    outcome: item.outcome,
    ...(item.parentChangeId === undefined ? {} : { parentChangeId: item.parentChangeId }),
    ...(item.acceptedTransactionVersion === undefined
      ? {}
      : { acceptedTransactionVersion: item.acceptedTransactionVersion }),
  };
}

export function mergeRepairStates(
  existing: readonly CloudLedgerRepairState[],
  incoming: readonly CloudLedgerRepairState[]
): readonly CloudLedgerRepairState[] {
  const incomingIds = new Set(incoming.map((repair) => repair.changeId));
  return [...existing.filter((repair) => !incomingIds.has(repair.changeId)), ...incoming];
}

export function mergeAutoRetryStates(
  existing: readonly CloudLedgerAutoRetryState[],
  incoming: readonly CloudLedgerAutoRetryState[]
): readonly CloudLedgerAutoRetryState[] {
  const incomingIds = new Set(incoming.map((retry) => retry.changeId));
  return [...existing.filter((retry) => !incomingIds.has(retry.changeId)), ...incoming];
}

function repairStateFromOutcome(
  batch: readonly CloudLedgerPendingChange[],
  batchOutcomes: readonly CloudLedgerPendingChangeOutcome[],
  outcome: CloudLedgerPendingChangeOutcome,
  retryAttempts: ReadonlyMap<LedgerChangeId, number>,
  previousRepairStates: readonly CloudLedgerRepairState[]
): CloudLedgerRepairState {
  const parentChangeId = parentProblemChangeId(
    batch,
    batchOutcomes,
    outcome,
    retryAttempts,
    previousRepairStates
  );
  return parentChangeId === undefined
    ? { changeId: outcome.changeId, outcome }
    : { changeId: outcome.changeId, outcome, parentChangeId };
}

function parentProblemChangeId(
  batch: readonly CloudLedgerPendingChange[],
  batchOutcomes: readonly CloudLedgerPendingChangeOutcome[],
  outcome: CloudLedgerPendingChangeOutcome,
  retryAttempts: ReadonlyMap<LedgerChangeId, number>,
  previousRepairStates: readonly CloudLedgerRepairState[]
): LedgerChangeId | undefined {
  if (outcome.code !== "dependency_failed") {
    return undefined;
  }
  const dependencies = batch.find((change) => change.id === outcome.changeId)?.dependencies ?? [];
  const surfacedParentIds = new Set([
    ...previousRepairStates.map((repair) => repair.changeId),
    ...batchOutcomes
      .filter((candidate) => candidate.changeId !== outcome.changeId)
      .filter((candidate) => shouldSurfaceRepairOutcome(candidate, retryAttempts))
      .map((candidate) => candidate.changeId),
  ]);
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
