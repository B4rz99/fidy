import type { LedgerChangeId } from "@/shared/types/branded";
import type { CloudLedgerApplyPendingChangesAccepted } from "./api-client";
import type { CloudLedgerPendingChange } from "./outbox";

const KEY_SEPARATOR = "\u0000";

export function acceptedPendingChanges(
  batch: readonly CloudLedgerPendingChange[],
  outcome: CloudLedgerApplyPendingChangesAccepted
): readonly CloudLedgerPendingChange[] {
  const orderedAccepted = orderedAcceptedPendingChanges(batch, outcome);
  return orderedAccepted ?? acceptedPendingChangesById(batch, outcome.acceptedChangeIds);
}

export function removePendingChangeOccurrences(
  queued: readonly CloudLedgerPendingChange[],
  changesToRemove: readonly CloudLedgerPendingChange[]
): readonly CloudLedgerPendingChange[] {
  const remainingRemovals = countedKeys(changesToRemove.map(pendingChangeKey));
  return queued.filter((change) => !consumeKey(remainingRemovals, pendingChangeKey(change)));
}

function orderedAcceptedPendingChanges(
  batch: readonly CloudLedgerPendingChange[],
  outcome: CloudLedgerApplyPendingChangesAccepted
): readonly CloudLedgerPendingChange[] | null {
  if (outcome.changeOutcomes.length !== batch.length) {
    return null;
  }
  const isOrdered = outcome.changeOutcomes.every(
    (changeOutcome, index) => changeOutcome.changeId === batch[index]?.id
  );
  return isOrdered
    ? batch.filter((_, index) => outcome.changeOutcomes[index]?.status === "accepted")
    : null;
}

function acceptedPendingChangesById(
  batch: readonly CloudLedgerPendingChange[],
  acceptedChangeIds: readonly LedgerChangeId[]
): readonly CloudLedgerPendingChange[] {
  const remainingAccepted = countedKeys(acceptedChangeIds);
  return batch.filter((change) => consumeKey(remainingAccepted, change.id));
}

function countedKeys(keys: readonly string[]): Map<string, number> {
  return keys.reduce((counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1), new Map());
}

function consumeKey(counts: Map<string, number>, key: string): boolean {
  const count = counts.get(key) ?? 0;
  if (count <= 0) {
    return false;
  }
  counts.set(key, count - 1);
  return true;
}

function pendingChangeKey(change: CloudLedgerPendingChange): string {
  return change.kind === "deleteTransaction"
    ? [
        change.id,
        change.kind,
        change.commandVersion,
        change.createdAt,
        change.transactionId,
        change.expectedVersion,
      ].join(KEY_SEPARATOR)
    : pendingTransactionChangeKey(change);
}

function pendingTransactionChangeKey(
  change: Extract<
    CloudLedgerPendingChange,
    { readonly kind: "amendTransaction" | "createTransaction" }
  >
): string {
  const transaction = change.transaction;
  return [
    change.id,
    change.kind,
    change.commandVersion,
    change.createdAt,
    "expectedVersion" in change ? change.expectedVersion : "",
    transaction.id,
    transaction.type,
    transaction.amount,
    transaction.currency,
    transaction.categoryId ?? "",
    transaction.accountId,
    transaction.description ?? "",
    transaction.date,
  ].join(KEY_SEPARATOR);
}
