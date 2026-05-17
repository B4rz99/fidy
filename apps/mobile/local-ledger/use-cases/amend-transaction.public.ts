import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
} from "@/shared/types/branded";
import type { LocalLedgerEntryId, UserId } from "../domain/public";
import type {
  RecordTransaction,
  RecordTransactionAccountAttributionState,
  RecordTransactionAccepted,
  RecordTransactionSource,
} from "./write.public";

export type AmendableTransaction = {
  readonly id: LocalLedgerEntryId;
  readonly userId: UserId;
  readonly accountAttributionState: RecordTransactionAccountAttributionState;
  readonly counterpartyName: string | null;
  readonly source: RecordTransactionSource;
};

export type AmendTransactionCommand = {
  readonly userId: UserId;
  readonly transactionId: LocalLedgerEntryId;
  readonly type: "expense" | "income";
  readonly amount: CopAmount;
  readonly accountId: FinancialAccountId | null;
  readonly categoryId: CategoryId | null;
  readonly occurredOn: IsoDate;
  readonly description: string | null;
};

export type AmendTransactionResult =
  | { readonly ok: true; readonly transaction: RecordTransactionAccepted }
  | {
      readonly ok: false;
      readonly code:
        | "transaction-not-found"
        | "future-dated-transaction"
        | "non-positive-amount"
        | "missing-account"
        | "account-not-usable"
        | "missing-category"
        | "category-not-usable"
        | "manual-source-requires-resolved-account"
        | "description-too-long"
        | "counterparty-name-too-long";
    };

export type AmendTransactionPorts = {
  readonly loadAmendableTransaction: (input: {
    readonly userId: UserId;
    readonly transactionId: LocalLedgerEntryId;
  }) => Promise<AmendableTransaction | null>;
  readonly recordTransaction: RecordTransaction;
};

export type AmendTransaction = (
  command: AmendTransactionCommand
) => Promise<AmendTransactionResult>;

export function createAmendTransactionUseCase(ports: AmendTransactionPorts): AmendTransaction {
  return async (command) => {
    const existing = await ports.loadAmendableTransaction({
      userId: command.userId,
      transactionId: command.transactionId,
    });
    if (existing === null) return { ok: false, code: "transaction-not-found" };

    return ports.recordTransaction({
      userId: command.userId,
      type: command.type,
      amount: command.amount,
      accountId: command.accountId,
      accountAttributionState: existing.accountAttributionState,
      categoryId: command.categoryId,
      occurredOn: command.occurredOn,
      description: command.description,
      counterpartyName: existing.counterpartyName,
      source: existing.source,
    });
  };
}

export type VoidTransactionCommand = {
  readonly userId: UserId;
  readonly transactionId: LocalLedgerEntryId;
  readonly now: IsoDateTime;
};

export type VoidTransactionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "transaction-not-found" | "transaction-not-voidable" };

export type VoidTransactionPorts = {
  readonly canVoidTransaction: (command: VoidTransactionCommand) => boolean;
  readonly commitVoidTransaction: (command: VoidTransactionCommand) => boolean;
};

export type VoidTransaction = (command: VoidTransactionCommand) => VoidTransactionResult;

export function createVoidTransactionUseCase(ports: VoidTransactionPorts): VoidTransaction {
  return (command) => {
    if (!ports.canVoidTransaction(command)) {
      return { ok: false, code: "transaction-not-voidable" };
    }

    return ports.commitVoidTransaction(command)
      ? { ok: true }
      : { ok: false, code: "transaction-not-found" };
  };
}
