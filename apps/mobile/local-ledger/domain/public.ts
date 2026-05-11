export type LocalLedgerCommandId = string & { readonly __brand: "LocalLedgerCommandId" };

export type LocalLedgerEntryId = string & { readonly __brand: "LocalLedgerEntryId" };

export type LocalLedgerSourceId = string & { readonly __brand: "LocalLedgerSourceId" };

export type LocalLedgerMoney = {
  readonly amountCents: number;
  readonly currency: "COP";
};

export type LocalLedgerEntry = {
  readonly id: LocalLedgerEntryId;
  readonly occurredAt: string;
  readonly money: LocalLedgerMoney;
  readonly description: string;
  readonly sourceId: LocalLedgerSourceId | null;
};
