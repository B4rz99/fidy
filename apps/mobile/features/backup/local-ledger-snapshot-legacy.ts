import { normalizeTransactionSource } from "@/shared/lib/transaction-source";
import type { BackupSnapshot, LocalLedgerBackupSnapshotData } from "./local-ledger-snapshot";
import type { BackupDataKey } from "./local-ledger-snapshot-row-shape";

const LEGACY_EMPTY_DATA_KEYS = [
  "processedSourceEvents",
  "reviewCandidates",
  "reviewCandidateCaptureEvidence",
] as const satisfies readonly BackupDataKey[];

export function withLegacyEmptyCollections(snapshot: BackupSnapshot): BackupSnapshot {
  const data = snapshot.data as Partial<LocalLedgerBackupSnapshotData>;
  return {
    ...snapshot,
    data: {
      ...snapshot.data,
      transactions: normalizeLegacyTransactionRows(snapshot.data.transactions),
      processedSourceEvents: data.processedSourceEvents ?? [],
      reviewCandidates: data.reviewCandidates ?? [],
      reviewCandidateCaptureEvidence: data.reviewCandidateCaptureEvidence ?? [],
    },
  };
}

export function rowsForBackupKey(data: Record<string, unknown>, key: BackupDataKey) {
  const rows = data[key];
  return rows === undefined && isLegacyEmptyDataKey(key) ? [] : rows;
}

function isLegacyEmptyDataKey(key: BackupDataKey) {
  return (LEGACY_EMPTY_DATA_KEYS as readonly BackupDataKey[]).includes(key);
}

function normalizeLegacyTransactionRows(rows: BackupSnapshot["data"]["transactions"]) {
  return rows.map(normalizeLegacyTransactionRow);
}

type TransactionRow = BackupSnapshot["data"]["transactions"][number];
type LegacyTransactionRow = TransactionRow & { readonly deletedAt?: unknown };

function normalizeLegacyTransactionRow(row: TransactionRow): TransactionRow {
  const legacyRow = row as LegacyTransactionRow;
  const { deletedAt, ...withoutDeletedAt } = legacyRow;
  return {
    ...withoutDeletedAt,
    ...legacyTransactionTextDefaults(row),
    ...legacyTransactionStateDefaults(row, deletedAt),
  };
}

const legacyTransactionTextDefaults = (row: TransactionRow) => ({
  counterpartyName: row.counterpartyName ?? null,
  supersededByTransferId: row.supersededByTransferId ?? null,
});

const legacyTransactionStateDefaults = (row: TransactionRow, deletedAt: unknown) => ({
  voidedAt: (row.voidedAt ?? deletedAt ?? null) as TransactionRow["voidedAt"],
  source: normalizeTransactionSource(row.source),
});
