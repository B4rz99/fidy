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
