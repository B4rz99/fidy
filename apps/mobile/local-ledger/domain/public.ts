import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransferId,
  UserId,
} from "@/shared/types/branded";

export type { FinancialAccountId, TransferId, UserId };

export type LocalLedgerCommandId = string & { readonly __brand: "LocalLedgerCommandId" };

export type LocalLedgerEntryId = string & { readonly __brand: "LocalLedgerEntryId" };

export type LocalLedgerSourceId = string & { readonly __brand: "LocalLedgerSourceId" };

export type LocalLedgerMoney = {
  readonly amount: CopAmount;
  readonly currency: "COP";
};

export type LocalLedgerEntry = {
  readonly id: LocalLedgerEntryId;
  readonly occurredAt: string;
  readonly money: LocalLedgerMoney;
  readonly description: string;
  readonly sourceId: LocalLedgerSourceId | null;
};

export type LocalLedgerTransferSide =
  | {
      readonly kind: "account";
      readonly accountId: FinancialAccountId;
    }
  | {
      readonly kind: "external";
      readonly label: string;
    };

export type LocalLedgerTransfer = {
  readonly id: TransferId;
  readonly userId: UserId;
  readonly amount: CopAmount;
  readonly fromSide: LocalLedgerTransferSide;
  readonly toSide: LocalLedgerTransferSide;
  readonly description: string;
  readonly date: IsoDate;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
};

export type LocalLedgerTransferRecorded = {
  readonly type: "local-ledger.transfer-recorded";
  readonly transferId: TransferId;
  readonly userId: UserId;
  readonly occurredAt: IsoDateTime;
};

export type LocalLedgerDomainEvent = LocalLedgerTransferRecorded;
