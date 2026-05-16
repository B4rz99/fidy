import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
} from "@/shared/types/branded";
import type {
  LocalLedgerDomainEvent,
  LocalLedgerTransfer,
  TransferSource,
  TransferId,
  UserId,
} from "../domain/public";
import type { RecordTransactionAccountAttributionState } from "./write.public";
import { transferRecordedEvent } from "./record-transfer-builders";

export type ReclassifiableTransaction = {
  readonly id: TransactionId;
  readonly userId: UserId;
  readonly type: "expense" | "income";
  readonly amount: CopAmount;
  readonly accountId: FinancialAccountId | null;
  readonly accountAttributionState: RecordTransactionAccountAttributionState;
  readonly date: IsoDate;
  readonly voidedAt: IsoDateTime | null;
  readonly supersededAt: IsoDateTime | null;
};

export type ReclassifyTransactionsAsTransferCommand = {
  readonly outgoingTransactionId: TransactionId;
  readonly incomingTransactionId: TransactionId;
  readonly description: string;
};

export type ReclassifyTransactionsAsTransferCommitInput = {
  readonly transfer: LocalLedgerTransfer;
  readonly outgoingTransactionId: TransactionId;
  readonly incomingTransactionId: TransactionId;
  readonly supersededAt: IsoDateTime;
};

export type ReclassifyTransactionsAsTransferCommitResult =
  | { readonly code: "committed"; readonly transfer: LocalLedgerTransfer }
  | { readonly code: "rejected"; readonly reason: "transactions-not-reclassifiable" };

export type ReclassifyTransactionsAsTransferPorts = {
  readonly loadTransaction: (
    transactionId: TransactionId
  ) => Promise<ReclassifiableTransaction | null>;
  readonly commitReclassification: (
    input: ReclassifyTransactionsAsTransferCommitInput
  ) => Promise<ReclassifyTransactionsAsTransferCommitResult>;
};

export type ReclassifyTransactionsAsTransferDependencies = {
  readonly userId: UserId;
  readonly source: TransferSource;
  readonly now: () => IsoDateTime;
  readonly generateTransferId: () => TransferId;
  readonly ports: ReclassifyTransactionsAsTransferPorts;
};

export type ReclassifyTransactionsAsTransferRejectionReason =
  | "transactions-not-found"
  | "transactions-not-reclassifiable";

export type ReclassifyTransactionsAsTransferResult =
  | {
      readonly code: "reclassified";
      readonly transfer: LocalLedgerTransfer;
      readonly events: readonly LocalLedgerDomainEvent[];
    }
  | {
      readonly code: "rejected";
      readonly reason: ReclassifyTransactionsAsTransferRejectionReason;
      readonly events: readonly [];
    };

export type ReclassifyTransactionsAsTransfer = (
  command: ReclassifyTransactionsAsTransferCommand
) => Promise<ReclassifyTransactionsAsTransferResult>;

type ReclassifiableAccountTransaction = ReclassifiableTransaction & {
  readonly accountId: FinancialAccountId;
};

const rejectReclassification = (
  reason: ReclassifyTransactionsAsTransferRejectionReason
): ReclassifyTransactionsAsTransferResult => ({ code: "rejected", reason, events: [] });

const isActiveUserTransaction = (
  transaction: ReclassifiableTransaction | null,
  userId: UserId
): transaction is ReclassifiableTransaction =>
  transaction != null &&
  transaction.userId === userId &&
  transaction.voidedAt === null &&
  transaction.supersededAt === null;

const hasResolvedAccountAttribution = (transaction: ReclassifiableTransaction): boolean =>
  transaction.accountAttributionState !== "unresolved";

const canReclassifyPair = (
  outgoing: ReclassifiableTransaction,
  incoming: ReclassifiableTransaction
): outgoing is ReclassifiableAccountTransaction =>
  outgoing.id !== incoming.id &&
  outgoing.type === "expense" &&
  incoming.type === "income" &&
  outgoing.amount > 0 &&
  outgoing.amount === incoming.amount &&
  outgoing.date === incoming.date &&
  hasResolvedAccountAttribution(outgoing) &&
  hasResolvedAccountAttribution(incoming) &&
  outgoing.accountId !== null &&
  incoming.accountId !== null &&
  outgoing.accountId !== incoming.accountId;

const hasReclassifiableIncomingAccount = (
  transaction: ReclassifiableTransaction
): transaction is ReclassifiableAccountTransaction => transaction.accountId !== null;

export function createReclassifyTransactionsAsTransfer(
  dependencies: ReclassifyTransactionsAsTransferDependencies
): ReclassifyTransactionsAsTransfer {
  return async (command) => {
    const [outgoing, incoming] = await Promise.all([
      dependencies.ports.loadTransaction(command.outgoingTransactionId),
      dependencies.ports.loadTransaction(command.incomingTransactionId),
    ]);

    if (
      !isActiveUserTransaction(outgoing, dependencies.userId) ||
      !isActiveUserTransaction(incoming, dependencies.userId)
    ) {
      return rejectReclassification("transactions-not-found");
    }

    if (!canReclassifyPair(outgoing, incoming) || !hasReclassifiableIncomingAccount(incoming)) {
      return rejectReclassification("transactions-not-reclassifiable");
    }

    const now = dependencies.now();
    const transfer: LocalLedgerTransfer = {
      id: dependencies.generateTransferId(),
      userId: dependencies.userId,
      amount: outgoing.amount,
      fromSide: { kind: "account", accountId: outgoing.accountId },
      toSide: { kind: "account", accountId: incoming.accountId },
      description: command.description.trim(),
      date: outgoing.date,
      source: dependencies.source,
      createdAt: now,
      updatedAt: now,
      voidedAt: null,
    };

    const commitResult = await dependencies.ports.commitReclassification({
      transfer,
      outgoingTransactionId: outgoing.id,
      incomingTransactionId: incoming.id,
      supersededAt: now,
    });

    return commitResult.code === "committed"
      ? {
          code: "reclassified",
          transfer: commitResult.transfer,
          events: [transferRecordedEvent(commitResult.transfer, now)],
        }
      : rejectReclassification("transactions-not-reclassifiable");
  };
}
