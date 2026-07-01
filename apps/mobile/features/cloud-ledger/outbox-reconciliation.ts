import type { LedgerChangeId } from "@/shared/types/branded";
import type {
  CloudLedgerApplyPendingChangesAccepted,
  CloudLedgerPendingChangeOutcome,
} from "./api-client";
import type { CloudLedgerPendingChange } from "./pending-changes";

type PendingTransactionChange = Extract<
  CloudLedgerPendingChange,
  { readonly kind: "amendTransaction" | "createTransaction" }
>;

const KEY_SEPARATOR = "\u0000";

const orderedAcceptedPendingChanges = (
  batch: readonly CloudLedgerPendingChange[],
  outcome: CloudLedgerApplyPendingChangesAccepted
): readonly CloudLedgerPendingChange[] | null => {
  if (outcome.changeOutcomes.length !== batch.length) {
    return null;
  }
  const isOrdered = outcome.changeOutcomes.every(
    (changeOutcome, index) => changeOutcome.changeId === batch[index]?.id
  );
  return isOrdered
    ? batch.filter((_, index) => outcome.changeOutcomes[index]?.status === "accepted")
    : null;
};

const acceptedPendingChangesById = (
  batch: readonly CloudLedgerPendingChange[],
  acceptedChangeIds: readonly LedgerChangeId[]
): readonly CloudLedgerPendingChange[] => {
  const remainingAccepted = countedKeys(acceptedChangeIds);
  return batch.filter((change) => consumeKey(remainingAccepted, change.id));
};

const orderedTerminalRejectedPendingChanges = (
  batch: readonly CloudLedgerPendingChange[],
  outcome: CloudLedgerApplyPendingChangesAccepted
): readonly CloudLedgerPendingChange[] | null => {
  if (outcome.changeOutcomes.length !== batch.length) {
    return null;
  }
  const isOrdered = outcome.changeOutcomes.every(
    (changeOutcome, index) => changeOutcome.changeId === batch[index]?.id
  );
  return isOrdered
    ? batch.filter((change, index) =>
        shouldDropTerminalRejectedPendingChange(change, outcome.changeOutcomes[index])
      )
    : null;
};

const terminalRejectedPendingChangesById = (
  batch: readonly CloudLedgerPendingChange[],
  changeIds: readonly LedgerChangeId[]
): readonly CloudLedgerPendingChange[] => {
  const remainingRejected = countedKeys(changeIds);
  return batch.filter(
    (change) => isVersionedChange(change) && consumeKey(remainingRejected, change.id)
  );
};

const terminalRejectedChangeIds = (
  outcomes: readonly CloudLedgerPendingChangeOutcome[]
): readonly LedgerChangeId[] =>
  outcomes
    .filter((outcome) => isStaleExpectedVersionOutcome(outcome))
    .map((outcome) => outcome.changeId);

const shouldDropTerminalRejectedPendingChange = (
  change: CloudLedgerPendingChange,
  outcome: CloudLedgerPendingChangeOutcome | undefined
): boolean =>
  outcome !== undefined && isVersionedChange(change) && isStaleExpectedVersionOutcome(outcome);

const isStaleExpectedVersionOutcome = (outcome: CloudLedgerPendingChangeOutcome): boolean =>
  outcome.status === "repair_required" && outcome.code === "stale_expected_version";

const isVersionedChange = (change: CloudLedgerPendingChange): boolean =>
  change.kind === "amendTransaction" || change.kind === "deleteTransaction";

const countedKeys = (keys: readonly string[]): Map<string, number> =>
  keys.reduce((counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1), new Map());

const consumeKey = (counts: Map<string, number>, key: string): boolean => {
  const count = counts.get(key) ?? 0;
  if (count <= 0) {
    return false;
  }
  counts.set(key, count - 1);
  return true;
};

const pendingTransactionChangeKey = (change: PendingTransactionChange): string => {
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
};

const pendingChangeKey = (change: CloudLedgerPendingChange): string =>
  change.kind === "unsupported"
    ? [
        change.id,
        change.kind,
        change.originalKind,
        change.commandVersion,
        change.createdAt ?? "",
        JSON.stringify(change.rawCommand),
      ].join(KEY_SEPARATOR)
    : change.kind === "deleteTransaction"
      ? [
          change.id,
          change.kind,
          change.commandVersion,
          change.createdAt,
          change.transactionId,
          change.expectedVersion,
        ].join(KEY_SEPARATOR)
      : pendingTransactionChangeKey(change);

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

export function terminalRejectedPendingChanges(
  batch: readonly CloudLedgerPendingChange[],
  outcome: CloudLedgerApplyPendingChangesAccepted
): readonly CloudLedgerPendingChange[] {
  const orderedTerminalRejected = orderedTerminalRejectedPendingChanges(batch, outcome);
  return (
    orderedTerminalRejected ??
    terminalRejectedPendingChangesById(batch, terminalRejectedChangeIds(outcome.changeOutcomes))
  );
}
