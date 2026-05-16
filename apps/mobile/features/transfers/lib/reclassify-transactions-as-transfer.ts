import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  getTransactionById,
  markTransactionSuperseded,
} from "@/features/transactions/transfer-reclassification.public";
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
import {
  buildTransfer,
  type StoredTransfer,
  type TransferBuildError,
  toTransferRow,
} from "./build-transfer";
import type { TransferRow } from "./repository";
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
  readonly saveTransferRow?: (db: Parameters<typeof saveTransfer>[0], row: TransferRow) => void;
  readonly loadTransactionById?: typeof getTransactionById;
  readonly saveTransactionRow?: typeof markTransactionSuperseded;
  readonly canUseAccounts?: typeof canUseAccountsForReclassification;
};

export type ReclassifyTransactionsAsTransferError =
  | TransferBuildError
  | "transactionsNotFound"
  | "transactionsNotReclassifiable";

export type ReclassifyTransactionsAsTransferResult =
  | { readonly success: true; readonly transfer: StoredTransfer }
  | { readonly success: false; readonly error: ReclassifyTransactionsAsTransferError };

function isActiveUserTransaction(
  transaction: ReturnType<typeof getTransactionById>,
  userId: UserId
): transaction is NonNullable<ReturnType<typeof getTransactionById>> {
  return (
    transaction != null &&
    transaction.userId === userId &&
    transaction.voidedAt == null &&
    transaction.supersededAt == null
  );
}

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
): boolean => {
  return countActiveAccountsForReclassification(db, userId, accountIds) === accountIds.length;
};

function hasResolvedAccountAttribution(
  transaction: NonNullable<ReturnType<typeof getTransactionById>>
): boolean {
  return transaction.accountAttributionState !== "unresolved";
}

export function reclassifyTransactionsAsTransfer(
  db: Parameters<typeof saveTransfer>[0],
  input: ReclassifyTransactionsAsTransferInput,
  {
    now = () => new Date(),
    createId = generateTransferId,
    saveTransferRow = saveTransfer,
    loadTransactionById = getTransactionById,
    saveTransactionRow = markTransactionSuperseded,
    canUseAccounts = canUseAccountsForReclassification,
  }: ReclassifyTransactionsAsTransferDeps = {}
): ReclassifyTransactionsAsTransferResult {
  const outgoing = loadTransactionById(db, input.outgoingTransactionId);
  const incoming = loadTransactionById(db, input.incomingTransactionId);

  if (
    !isActiveUserTransaction(outgoing, input.userId) ||
    !isActiveUserTransaction(incoming, input.userId)
  ) {
    return { success: false, error: "transactionsNotFound" };
  }

  if (
    outgoing.id === incoming.id ||
    outgoing.type !== "expense" ||
    incoming.type !== "income" ||
    outgoing.amount !== incoming.amount ||
    outgoing.date !== incoming.date ||
    !hasResolvedAccountAttribution(outgoing) ||
    !hasResolvedAccountAttribution(incoming) ||
    outgoing.accountId == null ||
    incoming.accountId == null ||
    outgoing.accountId === incoming.accountId
  ) {
    return { success: false, error: "transactionsNotReclassifiable" };
  }

  const accountIds = [outgoing.accountId, incoming.accountId] as const;
  const nowDate = now();
  const built = buildTransfer({
    input: {
      digits: String(outgoing.amount),
      fromSide: { kind: "account", accountId: outgoing.accountId },
      toSide: { kind: "account", accountId: incoming.accountId },
      description: input.description,
      date: parseIsoDate(outgoing.date),
    },
    userId: input.userId,
    id: createId(),
    now: nowDate,
    source: "capture-match",
  });

  if (!built.success) {
    return built;
  }

  const updatedAt = toIsoDateTime(nowDate) as IsoDateTime;

  const commitResult = db.transaction((tx) => {
    if (!canUseAccounts(tx, input.userId, accountIds)) {
      return { success: false, error: "transactionsNotReclassifiable" } as const;
    }

    saveTransferRow(tx, toTransferRow(built.transfer));
    saveTransactionRow(tx, {
      id: outgoing.id,
      supersededAt: updatedAt,
      supersededByTransferId: built.transfer.id,
      updatedAt,
    });
    saveTransactionRow(tx, {
      id: incoming.id,
      supersededAt: updatedAt,
      supersededByTransferId: built.transfer.id,
      updatedAt,
    });

    return { success: true, transfer: built.transfer } as const;
  });

  return commitResult;
}
