import {
  createReclassifyTransactionsAsTransfer,
  type LocalLedgerTransfer,
  type ReclassifiableTransaction,
} from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { generateTransferId, toIsoDateTime } from "@/shared/lib.public";
import type {
  FinancialAccountId,
  IsoDateTime,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";
import { saveTransferStorageRow, toTransferRow } from "./record-transfer";
import { canUseAccountsForReclassification } from "./transfer-reclassification-accounts";
import {
  getReclassificationTransactionById,
  markReclassificationTransactionSuperseded,
  type ReclassificationTransactionRow,
  toReclassifiableTransaction,
} from "./transfer-reclassification-transactions";
export {
  reclassifyTransactionAsTransfer,
  type ReclassifyTransactionAsTransferError,
  type ReclassifyTransactionAsTransferResult,
} from "./transfer-reclassification-single";
export { markReclassificationTransactionSuperseded } from "./transfer-reclassification-transactions";

type ReclassifyTransactionsAsTransferInput = {
  readonly userId: UserId;
  readonly outgoingTransactionId: TransactionId;
  readonly incomingTransactionId: TransactionId;
  readonly description: string;
};

type ReclassifyTransactionsAsTransferDeps = {
  readonly now?: () => Date;
  readonly createId?: () => TransferId;
  readonly loadTransactionById?: typeof getReclassificationTransactionById;
  readonly saveTransferRow?: typeof saveTransferStorageRow;
  readonly saveTransactionRow?: typeof markReclassificationTransactionSuperseded;
  readonly canUseAccounts?: typeof canUseAccountsForReclassification;
};

type ReclassificationCommitDeps = {
  readonly canUseAccounts: typeof canUseAccountsForReclassification;
  readonly loadTransactionById: typeof getReclassificationTransactionById;
  readonly saveTransactionRow: typeof markReclassificationTransactionSuperseded;
  readonly saveTransferRow: typeof saveTransferStorageRow;
};

type ReclassificationCommitInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly transfer: LocalLedgerTransfer;
  readonly outgoingTransactionId: TransactionId;
  readonly incomingTransactionId: TransactionId;
  readonly supersededAt: IsoDateTime;
};

export type ReclassifyTransactionsAsTransferError =
  | "transactionsNotFound"
  | "transactionsNotReclassifiable";

export type ReclassifyTransactionsAsTransferResult =
  | { readonly success: true; readonly transfer: LocalLedgerTransfer }
  | { readonly success: false; readonly error: ReclassifyTransactionsAsTransferError };

const mapReclassificationError = (
  reason: "transactions-not-found" | "transactions-not-reclassifiable"
): ReclassifyTransactionsAsTransferError =>
  reason === "transactions-not-found" ? "transactionsNotFound" : "transactionsNotReclassifiable";

const canCommitCurrentTransactions = (
  outgoing: ReclassifiableTransaction | null,
  incoming: ReclassifiableTransaction | null,
  transfer: LocalLedgerTransfer,
  userId: UserId
): boolean =>
  outgoing !== null &&
  incoming !== null &&
  outgoing.userId === userId &&
  incoming.userId === userId &&
  outgoing.id !== incoming.id &&
  outgoing.type === "expense" &&
  incoming.type === "income" &&
  outgoing.amount === transfer.amount &&
  incoming.amount === transfer.amount &&
  outgoing.date === transfer.date &&
  incoming.date === transfer.date &&
  outgoing.accountId ===
    (transfer.fromSide.kind === "account" ? transfer.fromSide.accountId : null) &&
  incoming.accountId === (transfer.toSide.kind === "account" ? transfer.toSide.accountId : null) &&
  outgoing.accountAttributionState !== "unresolved" &&
  incoming.accountAttributionState !== "unresolved" &&
  outgoing.voidedAt === null &&
  incoming.voidedAt === null &&
  outgoing.supersededAt === null &&
  incoming.supersededAt === null;

const isSupersededByTransfer = (
  transaction: ReclassificationTransactionRow | null,
  transferId: TransferId,
  supersededAt: IsoDateTime
): boolean =>
  transaction !== null &&
  transaction.supersededAt === supersededAt &&
  transaction.supersededByTransferId === transferId;

const getTransferAccountIds = (
  transfer: LocalLedgerTransfer
): readonly [FinancialAccountId, FinancialAccountId] | null => {
  const fromAccountId = transfer.fromSide.kind === "account" ? transfer.fromSide.accountId : null;
  const toAccountId = transfer.toSide.kind === "account" ? transfer.toSide.accountId : null;
  return fromAccountId === null || toAccountId === null ? null : [fromAccountId, toAccountId];
};

const hasCommittedSupersessions = (
  db: AnyDb,
  input: ReclassificationCommitInput,
  loadTransactionById: typeof getReclassificationTransactionById
): boolean =>
  isSupersededByTransfer(
    loadTransactionById(db, input.outgoingTransactionId),
    input.transfer.id,
    input.supersededAt
  ) &&
  isSupersededByTransfer(
    loadTransactionById(db, input.incomingTransactionId),
    input.transfer.id,
    input.supersededAt
  );

const rejectedCommit = () =>
  ({ code: "rejected", reason: "transactions-not-reclassifiable" }) as const;

const canCommitReclassification = (
  input: ReclassificationCommitInput,
  deps: ReclassificationCommitDeps
): boolean => {
  const accountIds = getTransferAccountIds(input.transfer);
  const outgoing = toReclassifiableTransaction(
    deps.loadTransactionById(input.db, input.outgoingTransactionId)
  );
  const incoming = toReclassifiableTransaction(
    deps.loadTransactionById(input.db, input.incomingTransactionId)
  );
  return (
    accountIds !== null &&
    deps.canUseAccounts(input.db, input.userId, accountIds) &&
    canCommitCurrentTransactions(outgoing, incoming, input.transfer, input.userId)
  );
};

function persistSupersessions(
  input: ReclassificationCommitInput,
  deps: ReclassificationCommitDeps
) {
  deps.saveTransferRow(input.db, toTransferRow(input.transfer));
  deps.saveTransactionRow(input.db, {
    id: input.outgoingTransactionId,
    supersededAt: input.supersededAt,
    supersededByTransferId: input.transfer.id,
    updatedAt: input.supersededAt,
  });
  deps.saveTransactionRow(input.db, {
    id: input.incomingTransactionId,
    supersededAt: input.supersededAt,
    supersededByTransferId: input.transfer.id,
    updatedAt: input.supersededAt,
  });
}

function commitPairReclassification(
  input: ReclassificationCommitInput,
  deps: ReclassificationCommitDeps
) {
  if (!canCommitReclassification(input, deps)) return rejectedCommit();

  persistSupersessions(input, deps);
  if (!hasCommittedSupersessions(input.db, input, deps.loadTransactionById)) {
    throw new Error("transfer reclassification did not supersede both source transactions");
  }

  return { code: "committed", transfer: input.transfer } as const;
}

export async function reclassifyTransactionsAsTransfer(
  db: AnyDb,
  input: ReclassifyTransactionsAsTransferInput,
  {
    now = () => new Date(),
    createId = generateTransferId,
    loadTransactionById = getReclassificationTransactionById,
    saveTransferRow = saveTransferStorageRow,
    saveTransactionRow = markReclassificationTransactionSuperseded,
    canUseAccounts = canUseAccountsForReclassification,
  }: ReclassifyTransactionsAsTransferDeps = {}
): Promise<ReclassifyTransactionsAsTransferResult> {
  const nowDate = now();
  const nowIso = toIsoDateTime(nowDate) as IsoDateTime;
  const reclassify = createReclassifyTransactionsAsTransfer({
    userId: input.userId,
    source: "capture-match",
    now: () => nowIso,
    generateTransferId: createId,
    ports: {
      loadTransaction: async (transactionId) =>
        toReclassifiableTransaction(loadTransactionById(db, transactionId)),
      commitReclassification: async ({
        transfer,
        outgoingTransactionId,
        incomingTransactionId,
        supersededAt,
      }) =>
        db.transaction((tx) =>
          commitPairReclassification(
            {
              db: tx,
              userId: input.userId,
              transfer,
              outgoingTransactionId,
              incomingTransactionId,
              supersededAt,
            },
            { canUseAccounts, loadTransactionById, saveTransferRow, saveTransactionRow }
          )
        ),
    },
  });

  const result = await reclassify({
    outgoingTransactionId: input.outgoingTransactionId,
    incomingTransactionId: input.incomingTransactionId,
    description: input.description,
  });

  return result.code === "reclassified"
    ? { success: true, transfer: result.transfer }
    : { success: false, error: mapReclassificationError(result.reason) };
}
