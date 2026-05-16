import type {
  BackupSnapshot,
  BudgetSnapshotRow,
  CaptureEvidenceSnapshotRow,
  FinancialAccountIdentifierSnapshotRow,
  FinancialAccountSnapshotRow,
  LocalLedgerBackupSnapshotData,
  OpeningBalanceSnapshotRow,
  TransferSnapshotRow,
} from "./snapshot";
import { rowsForBackupKey, withLegacyEmptyCollections } from "./legacy";
import { BACKUP_DATA_KEYS, validateSnapshotRows } from "./row-shape";
import { LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION } from "./version";

const BUILT_IN_CATEGORY_IDS = [
  "food",
  "transport",
  "entertainment",
  "health",
  "education",
  "home",
  "clothing",
  "services",
  "other",
] as const;

export function validateBackupSnapshot(snapshot: unknown): BackupSnapshot {
  assertSnapshotRecord(snapshot);
  assertSupportedSnapshotVersion(snapshot);
  assertVersionOneSnapshotShape(snapshot);

  const typedSnapshot = withLegacyEmptyCollections(snapshot as BackupSnapshot);
  validateSnapshotRows(typedSnapshot);
  validateDuplicatePrimaryIds(typedSnapshot.data);
  validateSnapshotReferences(typedSnapshot.data);
  validateLocalLedgerInvariants(typedSnapshot.data);

  return typedSnapshot;
}

function assertSnapshotRecord(snapshot: unknown): asserts snapshot is Record<string, unknown> {
  if (!isRecord(snapshot)) {
    throw new Error("Malformed local ledger backup snapshot");
  }
}

function assertSupportedSnapshotVersion(snapshot: Record<string, unknown>) {
  if (snapshot.version !== LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported local ledger backup snapshot version: ${String(snapshot.version)}`
    );
  }
}

function assertVersionOneSnapshotShape(snapshot: Record<string, unknown>) {
  const data = snapshot.data;
  if (typeof snapshot.exportedAt !== "string" || !isRecord(data)) {
    throw new Error("Malformed local ledger backup snapshot");
  }

  if (!hasBackupTableArrays(data) || !hasBackupTableRows(data)) {
    throw new Error("Malformed local ledger backup snapshot");
  }
}

function validateDuplicatePrimaryIds(data: LocalLedgerBackupSnapshotData) {
  BACKUP_DATA_KEYS.forEach((key) => {
    assertUniqueValues(
      data[key].map((row) => row.id),
      `Duplicate local ledger backup primary id in ${key}`
    );
  });
}

function validateSnapshotReferences(data: LocalLedgerBackupSnapshotData) {
  const accountIds = toIdSet(data.financialAccounts);
  const transactionIds = toIdSet(data.transactions);
  const transferIds = toIdSet(data.transfers);
  const goalIds = toIdSet(data.goals);
  const processedEmailIds = toIdSet(data.processedEmails);
  const processedCaptureIds = toIdSet(data.processedCaptures);
  const processedSourceEventIds = toIdSet(data.processedSourceEvents);
  const reviewCandidateIds = toIdSet(data.reviewCandidates);
  const captureEvidenceIds = toIdSet(data.captureEvidence);
  const categoryIds = new Set([
    ...BUILT_IN_CATEGORY_IDS,
    ...data.userCategories.map((category) => category.id),
  ]);

  data.transactions.forEach((row) => {
    assertKnownReference(accountIds, row.accountId, "transactions.accountId");
    assertKnownReference(categoryIds, row.categoryId, "transactions.categoryId");
    assertOptionalKnownReference(
      transferIds,
      row.supersededByTransferId,
      "transactions.supersededByTransferId"
    );
  });
  data.transfers.forEach((row) => {
    assertOptionalKnownReference(accountIds, row.fromAccountId, "transfers.fromAccountId");
    assertOptionalKnownReference(accountIds, row.toAccountId, "transfers.toAccountId");
  });
  data.openingBalances.forEach((row) => {
    assertKnownReference(accountIds, row.accountId, "openingBalances.accountId");
  });
  data.financialAccountIdentifiers.forEach((row) => {
    assertKnownReference(accountIds, row.accountId, "financialAccountIdentifiers.accountId");
  });
  data.budgets.forEach((row) => {
    assertKnownReference(categoryIds, row.categoryId, "budgets.categoryId");
  });
  data.goalContributions.forEach((row) => {
    assertKnownReference(goalIds, row.goalId, "goalContributions.goalId");
  });
  data.processedEmails.forEach((row) => {
    assertOptionalKnownReference(
      transactionIds,
      row.transactionId,
      "processedEmails.transactionId"
    );
  });
  data.processedCaptures.forEach((row) => {
    assertOptionalKnownReference(
      transactionIds,
      row.transactionId,
      "processedCaptures.transactionId"
    );
  });
  data.captureEvidence.forEach((row) => {
    assertOptionalKnownReference(
      transactionIds,
      row.transactionId,
      "captureEvidence.transactionId"
    );
    assertOptionalKnownReference(transferIds, row.transferId, "captureEvidence.transferId");
    assertOptionalKnownReference(
      processedEmailIds,
      row.processedEmailId,
      "captureEvidence.processedEmailId"
    );
    assertOptionalKnownReference(
      processedCaptureIds,
      row.processedCaptureId,
      "captureEvidence.processedCaptureId"
    );
    assertOptionalKnownReference(
      processedSourceEventIds,
      row.processedSourceEventId,
      "captureEvidence.processedSourceEventId"
    );
  });
  data.reviewCandidates.forEach((row) => {
    assertKnownReference(
      processedSourceEventIds,
      row.processedSourceEventId,
      "reviewCandidates.processedSourceEventId"
    );
  });
  data.reviewCandidateCaptureEvidence.forEach((row) => {
    assertKnownReference(
      reviewCandidateIds,
      row.reviewCandidateId,
      "reviewCandidateCaptureEvidence.reviewCandidateId"
    );
    assertKnownReference(
      captureEvidenceIds,
      row.captureEvidenceId,
      "reviewCandidateCaptureEvidence.captureEvidenceId"
    );
  });
}

function validateLocalLedgerInvariants(data: LocalLedgerBackupSnapshotData) {
  assertUniqueActiveOpeningBalancePerAccount(data.openingBalances);
  assertUniqueDefaultAccountPerUser(data.financialAccounts);
  assertUniqueActiveAccountIdentifiers(data.financialAccountIdentifiers);
  assertUniqueBudgets(data.budgets);
  data.transfers.forEach(assertValidTransferEndpoints);
  data.captureEvidence.forEach(assertValidCaptureEvidenceLinks);
}

function assertUniqueActiveOpeningBalancePerAccount(rows: readonly OpeningBalanceSnapshotRow[]) {
  assertUniqueValues(
    rows.filter((row) => row.deletedAt === null).map((row) => row.accountId),
    "Local ledger backup has multiple active opening balances for an account"
  );
}

function assertUniqueDefaultAccountPerUser(rows: readonly FinancialAccountSnapshotRow[]) {
  assertUniqueValues(
    rows.filter((row) => row.deletedAt === null && row.isDefault).map((row) => row.userId),
    "Local ledger backup has multiple default financial accounts for a user"
  );
}

function assertUniqueActiveAccountIdentifiers(
  rows: readonly FinancialAccountIdentifierSnapshotRow[]
) {
  assertUniqueValues(
    rows
      .filter((row) => row.deletedAt === null)
      .map((row) => [row.userId, row.accountId, row.scope, row.value].join("\u0000")),
    "Local ledger backup has duplicate active financial account identifiers"
  );
}

function assertUniqueBudgets(rows: readonly BudgetSnapshotRow[]) {
  assertUniqueValues(
    rows.map((row) => [row.userId, row.categoryId, row.month].join("\u0000")),
    "Local ledger backup has duplicate budgets for a user category month"
  );
}

function assertValidTransferEndpoints(row: TransferSnapshotRow) {
  if (!hasTransferEndpoint(row.fromAccountId, row.fromExternalLabel)) {
    throw new Error("Local ledger backup transfer is missing a required endpoint");
  }
  if (!hasTransferEndpoint(row.toAccountId, row.toExternalLabel)) {
    throw new Error("Local ledger backup transfer is missing a required endpoint");
  }
  if (usesSameTrackedAccount(row)) {
    throw new Error("Local ledger backup transfer uses the same account on both sides");
  }
}

const hasTransferEndpoint = (accountId: string | null, externalLabel: string | null) =>
  accountId !== null || hasText(externalLabel);

const usesSameTrackedAccount = (row: TransferSnapshotRow) =>
  row.fromAccountId !== null && row.fromAccountId === row.toAccountId;

function assertValidCaptureEvidenceLinks(row: CaptureEvidenceSnapshotRow) {
  const sourceRecords = [
    row.processedEmailId,
    row.processedCaptureId,
    row.processedSourceEventId,
  ].filter(isPresent).length;
  const financialLinks = [row.transactionId, row.transferId].filter(isPresent).length;

  if (sourceRecords !== 1) {
    throw new Error("Local ledger backup capture evidence must link to one source record");
  }
  if (financialLinks > 1) {
    throw new Error(
      "Local ledger backup capture evidence cannot link to both a transaction and a transfer"
    );
  }
}

function hasBackupTableArrays(data: Record<string, unknown>) {
  return BACKUP_DATA_KEYS.every((key) => Array.isArray(rowsForBackupKey(data, key)));
}

function hasBackupTableRows(data: Record<string, unknown>) {
  return BACKUP_DATA_KEYS.every((key) => {
    const rows = rowsForBackupKey(data, key);
    return Array.isArray(rows) && rows.every(isRecord);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const toIdSet = (rows: readonly { readonly id: string }[]) => new Set(rows.map((row) => row.id));

function assertUniqueValues(values: readonly string[], message: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(message);
  }
}

function assertKnownReference(ids: ReadonlySet<string>, value: string, label: string) {
  if (!ids.has(value)) {
    throw new Error(`Local ledger backup has unresolved reference: ${label}`);
  }
}

function assertOptionalKnownReference(
  ids: ReadonlySet<string>,
  value: string | null,
  label: string
) {
  if (value !== null) {
    assertKnownReference(ids, value, label);
  }
}

const hasText = (value: string | null) => value !== null && value.trim().length > 0;
const isPresent = (value: string | null) => value !== null;
