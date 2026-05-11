import type { LocalLedgerEntry, LocalLedgerEntryId } from "../domain/public";

export type LocalLedgerEntryRepository = {
  readonly findById: (id: LocalLedgerEntryId) => Promise<LocalLedgerEntry | null>;
  readonly save: (entry: LocalLedgerEntry) => Promise<LocalLedgerEntry>;
};
