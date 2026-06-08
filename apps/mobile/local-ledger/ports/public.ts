import type { LocalLedgerTransfer } from "../domain/public";

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
