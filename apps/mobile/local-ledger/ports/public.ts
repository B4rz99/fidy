import type {
  LocalLedgerEntry,
  LocalLedgerEntryId,
  LocalLedgerTransfer,
} from "../domain/public";

export type LocalLedgerEntryRepository = {
  readonly findById: (id: LocalLedgerEntryId) => Promise<LocalLedgerEntry | null>;
  readonly save: (entry: LocalLedgerEntry) => Promise<LocalLedgerEntry>;
};

export type LocalLedgerTransferRepository = {
  readonly record: (transfer: LocalLedgerTransfer) => Promise<LocalLedgerTransferRecordResult>;
};

export type LocalLedgerTransferRecordResult =
  | {
      readonly code: "recorded";
      readonly transfer: LocalLedgerTransfer;
    }
  | {
      readonly code: "account-not-usable";
    };
