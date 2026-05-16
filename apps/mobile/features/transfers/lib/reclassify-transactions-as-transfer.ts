import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  createReclassifyTransactionsAsTransfer,
  type LocalLedgerTransfer,
  type ReclassifiableTransaction,
} from "@/local-ledger/public";
import {
  getTransactionById,
  markTransactionSuperseded,
} from "@/features/transactions/transfer-reclassification.public";
import { toTransferRow } from "@/infrastructure/local-ledger/record-transfer";
import type { AnyDb } from "@/shared/db";
import { financialAccounts } from "@/shared/db/schema";
import { parseIsoDate, toIsoDateTime } from "@/shared/lib/format-date";
import { generateTransferId } from "@/shared/lib.public";
import type {
  FinancialAccountId,
  IsoDateTime,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";
import type { StoredTransfer } from "./build-transfer";
import { saveTransfer } from "./repository";

type ReclassifyTransactionsAsTransferInput = {
  readonly userId: UserId;
  readonly outgoingTransactionId: TransactionId;
  readonly incomingTransactionId: TransactionId;
  readonly description: string;
};

type ReclassifyTransactionsAsTransferDeps = {
  readonly now?: () => Date;
  readonly createId?: () => TransferId;
  readonly loadTransactionById?: typeof getTransactionById;
  readonly saveTransferRow?: (
    db: Parameters<typeof saveTransfer>[0],
    row: ReturnType<typeof toTransferRow>
  ) => void;
  readonly saveTransactionRow?: typeof markTransactionSuperseded;
  readonly canUseAccounts?: typeof canUseAccountsForReclassification;
};

type ReclassificationCommitDeps = {
  readonly canUseAccounts: typeof canUseAccountsForReclassification;
  readonly loadTransactionById: typeof getTransactionById;
  readonly saveTransactionRow: typeof markTransactionSuperseded;
  readonly saveTransferRow: NonNullable<ReclassifyTransactionsAsTransferDeps["saveTransferRow"]>;
};

type ReclassificationCommitInput = {
  readonly db: Parameters<typeof saveTransfer>[0];
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
  | { readonly success: true; readonly transfer: StoredTransfer }
  | { readonly success: false; readonly error: ReclassifyTransactionsAsTransferError };

const toStoredTransfer = (transfer: LocalLedgerTransfer): StoredTransfer => ({
  id: transfer.id,
  userId: transfer.userId,
  amount: transfer.amount,
  fromSide: transfer.fromSide,
  toSide: transfer.toSide,
  description: transfer.description,
  date: parseIsoDate(transfer.date),
  source: transfer.source,
  createdAt: new Date(transfer.createdAt),
  updatedAt: new Date(transfer.updatedAt),
  deletedAt: transfer.voidedAt === null ? null : new Date(transfer.voidedAt),
});

const countActiveAccountsForReclassification = (
  db: AnyDb,
  userId: UserId,
  accountIds: readonly [FinancialAccountId, FinancialAccountId]
): number => {
  return db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.userId, userId),
        inArray(financialAccounts.id, accountIds),
        isNull(financialAccounts.deletedAt)
      )
    )
    .all().length;
};

const canUseAccountsForReclassification = (
  db: AnyDb,
  userId: UserId,
  accountIds: readonly [FinancialAccountId, FinancialAccountId]
): boolean => countActiveAccountsForReclassification(db, userId, accountIds) === accountIds.length;

const toReclassifiableTransaction = (
  transaction: ReturnType<typeof getTransactionById>
): ReclassifiableTransaction | null =>
  transaction === null || (transaction.type !== "expense" && transaction.type !== "income")
    ? null
    : {
        id: transaction.id,
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        accountId: transaction.accountId ?? null,
        accountAttributionState:
          transaction.accountAttributionState === "confirmed" ||
          transaction.accountAttributionState === "inferred"
            ? transaction.accountAttributionState
            : "unresolved",
        date: transaction.date,
        voidedAt: transaction.voidedAt ?? null,
        supersededAt: transaction.supersededAt ?? null,
      };

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
  transaction: ReturnType<typeof getTransactionById>,
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
  db: Parameters<typeof saveTransfer>[0],
  input: ReclassificationCommitInput,
  loadTransactionById: typeof getTransactionById
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

function commitReclassification(
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
  db: Parameters<typeof saveTransfer>[0],
  input: ReclassifyTransactionsAsTransferInput,
  {
    now = () => new Date(),
    createId = generateTransferId,
    loadTransactionById = getTransactionById,
    saveTransferRow = saveTransfer,
    saveTransactionRow = markTransactionSuperseded,
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
          commitReclassification(
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
    ? { success: true, transfer: toStoredTransfer(result.transfer) }
    : { success: false, error: mapReclassificationError(result.reason) };
}
