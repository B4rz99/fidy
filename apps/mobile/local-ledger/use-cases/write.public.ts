import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
} from "@/shared/types/branded";
import type { NormalizedTransactionSource } from "@/shared/lib";
import type {
  LocalLedgerCommandId,
  LocalLedgerDomainEvent,
  LocalLedgerEntry,
  LocalLedgerEntryId,
  LocalLedgerTransfer,
  LocalLedgerTransferSide,
  TransferSource,
  TransferId,
  UserId,
} from "../domain/public";
import type { LocalLedgerTransferRepository } from "../ports/public";
import { toLocalLedgerTransfer, transferRecordedEvent } from "./record-transfer-builders";
import { reject } from "./record-transfer-result";
import {
  validateRecordTransfer,
  type ValidRecordTransferCommand,
} from "./record-transfer-validation";

export type WriteLocalLedgerEntryCommand = {
  readonly commandId: LocalLedgerCommandId;
  readonly entry: LocalLedgerEntry;
};

export type WriteLocalLedgerEntry = (
  command: WriteLocalLedgerEntryCommand
) => Promise<LocalLedgerEntry>;

export type RecordTransferCommand = {
  readonly userId: UserId;
  readonly transferId: TransferId;
  readonly amount: CopAmount;
  readonly fromSide: LocalLedgerTransferSide | null;
  readonly toSide: LocalLedgerTransferSide | null;
  readonly description: string;
  readonly date: IsoDate;
  readonly source: TransferSource;
  readonly now: IsoDateTime;
};

export type RecordTransferResult =
  | {
      readonly code: "recorded";
      readonly transfer: LocalLedgerTransfer;
      readonly events: readonly LocalLedgerDomainEvent[];
    }
  | {
      readonly code: "rejected";
      readonly reason: RecordTransferRejectionReason;
      readonly events: readonly [];
    };

export type RecordTransferRejectionReason =
  | "future-dated"
  | "amount-not-positive"
  | "from-side-required"
  | "to-side-required"
  | "tracked-account-required"
  | "same-account"
  | "account-not-usable"
  | "external-label-required"
  | "command-user-mismatch";

export type RecordTransfer = (command: RecordTransferCommand) => Promise<RecordTransferResult>;

export type RecordTransferDependencies = {
  readonly transfers: LocalLedgerTransferRepository;
  readonly today: () => IsoDate;
  readonly userId: UserId;
};

export function createRecordTransfer(dependencies: RecordTransferDependencies): RecordTransfer {
  return async (command) => {
    const validated = validateRecordTransfer(command, dependencies);
    if (validated.code === "rejected") return validated;

    return recordValidatedTransfer(validated.command, dependencies);
  };
}

async function recordValidatedTransfer(
  command: ValidRecordTransferCommand,
  dependencies: RecordTransferDependencies
): Promise<RecordTransferResult> {
  const transfer = toLocalLedgerTransfer(command, dependencies.userId);
  const recordResult = await dependencies.transfers.record(transfer);
  if (recordResult.code === "account-not-usable") return reject("account-not-usable");

  return {
    code: "recorded",
    transfer: recordResult.transfer,
    events: [transferRecordedEvent(recordResult.transfer, command.now)],
  };
}

export type RecordTransactionSource = NormalizedTransactionSource;

export type RecordTransactionAccountAttributionState = "confirmed" | "inferred" | "unresolved";

export type RecordTransactionCommand = {
  readonly userId: UserId;
  readonly type: "expense" | "income";
  readonly amount: CopAmount;
  readonly accountId: FinancialAccountId | null;
  readonly accountAttributionState: RecordTransactionAccountAttributionState;
  readonly categoryId: CategoryId | null;
  readonly occurredOn: IsoDate;
  readonly description: string | null;
  readonly counterpartyName: string | null;
  readonly source: RecordTransactionSource;
};

export type RecordTransactionAccepted = {
  readonly id: LocalLedgerEntryId;
  readonly userId: UserId;
  readonly type: RecordTransactionCommand["type"];
  readonly amount: CopAmount;
  readonly accountId: FinancialAccountId;
  readonly accountAttributionState: RecordTransactionAccountAttributionState;
  readonly categoryId: CategoryId;
  readonly occurredOn: IsoDate;
  readonly description: string;
  readonly counterpartyName: string;
  readonly source: RecordTransactionSource;
};

export type RecordTransactionEvent = {
  readonly type: "local-ledger.transaction-recorded";
  readonly transactionId: LocalLedgerEntryId;
};

export type RecordTransactionRejectCode =
  | "future-dated-transaction"
  | "non-positive-amount"
  | "missing-account"
  | "account-not-usable"
  | "missing-category"
  | "category-not-usable"
  | "manual-source-requires-resolved-account"
  | "description-too-long"
  | "counterparty-name-too-long";

export type RecordTransactionResult =
  | {
      readonly ok: true;
      readonly transaction: RecordTransactionAccepted;
      readonly events: readonly RecordTransactionEvent[];
    }
  | { readonly ok: false; readonly code: RecordTransactionRejectCode };

export type RecordTransactionCommitResult =
  | { readonly ok: true; readonly transaction: RecordTransactionAccepted }
  | { readonly ok: false; readonly code: "account-not-usable" | "category-not-usable" };

export type RecordTransactionPorts = {
  readonly commit: (
    transaction: RecordTransactionAccepted
  ) => Promise<RecordTransactionCommitResult>;
  readonly canUseAccount: (input: {
    readonly userId: UserId;
    readonly accountId: FinancialAccountId;
  }) => Promise<boolean>;
  readonly canUseCategory: (input: {
    readonly userId: UserId;
    readonly categoryId: CategoryId;
  }) => Promise<boolean>;
  readonly today: () => IsoDate;
  readonly generateEntryId: () => LocalLedgerEntryId;
};

export type RecordTransactionInput = {
  readonly command: RecordTransactionCommand;
  readonly ports: RecordTransactionPorts;
};

const MAX_TEXT_LENGTH = 200;

const normalizeText = (value: string | null): string => (value ?? "").trim();

const textRejectCode = (
  description: string,
  counterpartyName: string
): RecordTransactionRejectCode | null => {
  if (description.length > MAX_TEXT_LENGTH) return "description-too-long";
  if (counterpartyName.length > MAX_TEXT_LENGTH) return "counterparty-name-too-long";

  return null;
};

const isFutureDated = (occurredOn: IsoDate, today: IsoDate): boolean => occurredOn > today;

const toEvent = (transaction: RecordTransactionAccepted): RecordTransactionEvent => ({
  type: "local-ledger.transaction-recorded",
  transactionId: transaction.id,
});

const rejectTransaction = (code: RecordTransactionRejectCode): RecordTransactionResult => ({
  ok: false,
  code,
});

const getCommandRejectCode = (
  command: RecordTransactionCommand,
  today: IsoDate
): RecordTransactionRejectCode | null => {
  const description = normalizeText(command.description);
  const counterpartyName = normalizeText(command.counterpartyName);

  if (isFutureDated(command.occurredOn, today)) return "future-dated-transaction";
  if (command.amount <= 0) return "non-positive-amount";
  if (command.accountId === null) return "missing-account";
  if (command.categoryId === null) return "missing-category";
  if (command.source === "manual" && command.accountAttributionState === "unresolved") {
    return "manual-source-requires-resolved-account";
  }

  return textRejectCode(description, counterpartyName);
};

const getPolicyRejectCode = async (
  command: RecordTransactionCommand & {
    readonly accountId: FinancialAccountId;
    readonly categoryId: CategoryId;
  },
  ports: RecordTransactionPorts
): Promise<RecordTransactionRejectCode | null> => {
  if (!(await ports.canUseAccount({ userId: command.userId, accountId: command.accountId }))) {
    return "account-not-usable";
  }
  if (!(await ports.canUseCategory({ userId: command.userId, categoryId: command.categoryId }))) {
    return "category-not-usable";
  }

  return null;
};

const toAcceptedTransaction = (
  command: RecordTransactionCommand & {
    readonly accountId: FinancialAccountId;
    readonly categoryId: CategoryId;
  },
  id: LocalLedgerEntryId
): RecordTransactionAccepted => ({
  id,
  userId: command.userId,
  type: command.type,
  amount: command.amount,
  accountId: command.accountId,
  accountAttributionState: command.accountAttributionState,
  categoryId: command.categoryId,
  occurredOn: command.occurredOn,
  description: normalizeText(command.description),
  counterpartyName: normalizeText(command.counterpartyName),
  source: command.source,
});

const toSuccess = (transaction: RecordTransactionAccepted): RecordTransactionResult => ({
  ok: true,
  transaction,
  events: [toEvent(transaction)],
});

const toCommitResult = (result: RecordTransactionCommitResult): RecordTransactionResult => {
  if (result.ok) return toSuccess(result.transaction);

  return result;
};

export const recordTransaction = async ({
  command,
  ports,
}: RecordTransactionInput): Promise<RecordTransactionResult> => {
  const commandRejectCode = getCommandRejectCode(command, ports.today());
  if (commandRejectCode !== null) return rejectTransaction(commandRejectCode);

  const acceptedCommand = command as RecordTransactionCommand & {
    readonly accountId: FinancialAccountId;
    readonly categoryId: CategoryId;
  };
  const policyRejectCode = await getPolicyRejectCode(acceptedCommand, ports);
  if (policyRejectCode !== null) return rejectTransaction(policyRejectCode);

  return toCommitResult(
    await ports.commit(toAcceptedTransaction(acceptedCommand, ports.generateEntryId()))
  );
};
