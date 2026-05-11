import type { LocalLedgerCommandId, LocalLedgerEntry } from "../domain/public";

export type WriteLocalLedgerEntryCommand = {
  readonly commandId: LocalLedgerCommandId;
  readonly entry: LocalLedgerEntry;
};

export type WriteLocalLedgerEntry = (
  command: WriteLocalLedgerEntryCommand
) => Promise<LocalLedgerEntry>;
