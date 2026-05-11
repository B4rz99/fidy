import { captureEvidenceTypeSchema } from "@/features/capture-evidence/schema.public";
import type { BackupSnapshot, LocalLedgerBackupSnapshotData } from "./local-ledger-snapshot";
import {
  assertBoolean,
  assertCopAmountValue,
  assertNullableIsoDateTime,
  assertNullableNumber,
  assertNullableString,
  assertOneOf,
  assertRecordShape,
  assertString,
  assertValidIsoDate,
  assertValidIsoDateTime,
  assertValidMonth,
  validateBaseLedgerFields,
} from "./local-ledger-snapshot-row-assertions";
import { INTAKE_ROW_SPECS } from "./local-ledger-snapshot-row-shape-intake";

export function validateSnapshotRows(snapshot: BackupSnapshot) {
  assertValidIsoDateTime(snapshot.exportedAt, "exportedAt");
  ROW_SPECS.forEach((spec) => {
    snapshot.data[spec.key].forEach((row) => {
      spec.validate(row);
    });
  });
}

export const BACKUP_DATA_KEYS = [
  "transactions",
  "transfers",
  "userCategories",
  "financialAccounts",
  "openingBalances",
  "budgets",
  "goals",
  "goalContributions",
  "captureEvidence",
  "financialAccountIdentifiers",
  "accountSuggestionDismissals",
  "processedEmails",
  "processedCaptures",
  "processedSourceEvents",
  "reviewCandidates",
  "reviewCandidateCaptureEvidence",
] as const;

export type BackupDataKey = (typeof BACKUP_DATA_KEYS)[number];

export type RowSpec<Key extends BackupDataKey = BackupDataKey> = {
  readonly key: Key;
  readonly validate: (row: LocalLedgerBackupSnapshotData[Key][number]) => void;
};

const ROW_SPECS: readonly RowSpec[] = [
  {
    key: "transactions",
    validate: (row) =>
      assertRecordShape(
        row,
        "transactions",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          type: (value) => assertOneOf(["expense", "income"], value, "type"),
          amount: (value) => assertCopAmountValue(value, "amount"),
          categoryId: (value) => assertString(value, "categoryId"),
          description: (value) => assertNullableString(value, "description"),
          date: (value) => assertValidIsoDate(value, "date"),
          accountId: (value) => assertString(value, "accountId"),
          accountAttributionState: (value) =>
            assertOneOf(["confirmed", "inferred", "unresolved"], value, "accountAttributionState"),
          supersededAt: (value) => assertNullableIsoDateTime(value, "supersededAt"),
          source: (value) => assertString(value, "source"),
        }),
        ["source"]
      ),
  },
  {
    key: "transfers",
    validate: (row) =>
      assertRecordShape(
        row,
        "transfers",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          amount: (value) => assertCopAmountValue(value, "amount"),
          fromAccountId: (value) => assertNullableString(value, "fromAccountId"),
          toAccountId: (value) => assertNullableString(value, "toAccountId"),
          fromExternalLabel: (value) => assertNullableString(value, "fromExternalLabel"),
          toExternalLabel: (value) => assertNullableString(value, "toExternalLabel"),
          description: (value) => assertNullableString(value, "description"),
          date: (value) => assertValidIsoDate(value, "date"),
        })
      ),
  },
  {
    key: "userCategories",
    validate: (row) =>
      assertRecordShape(
        row,
        "userCategories",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          name: (value) => assertString(value, "name"),
          iconName: (value) => assertString(value, "iconName"),
          colorHex: (value) => assertString(value, "colorHex"),
        })
      ),
  },
  {
    key: "financialAccounts",
    validate: (row) =>
      assertRecordShape(
        row,
        "financialAccounts",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          name: (value) => assertString(value, "name"),
          kind: (value) =>
            assertOneOf(["checking", "cash", "wallet", "savings", "credit_card"], value, "kind"),
          isDefault: (value) => assertBoolean(value, "isDefault"),
          statementClosingDay: (value) => assertNullableNumber(value, "statementClosingDay"),
          paymentDueDay: (value) => assertNullableNumber(value, "paymentDueDay"),
        }),
        ["statementClosingDay", "paymentDueDay"]
      ),
  },
  {
    key: "openingBalances",
    validate: (row) =>
      assertRecordShape(
        row,
        "openingBalances",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          accountId: (value) => assertString(value, "accountId"),
          amount: (value) => assertCopAmountValue(value, "amount"),
          effectiveDate: (value) => assertValidIsoDate(value, "effectiveDate"),
        })
      ),
  },
  {
    key: "budgets",
    validate: (row) =>
      assertRecordShape(
        row,
        "budgets",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          categoryId: (value) => assertString(value, "categoryId"),
          amount: (value) => assertCopAmountValue(value, "amount"),
          month: (value) => assertValidMonth(value, "month"),
        })
      ),
  },
  {
    key: "goals",
    validate: (row) =>
      assertRecordShape(
        row,
        "goals",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          name: (value) => assertString(value, "name"),
          type: (value) => assertOneOf(["savings", "debt"], value, "type"),
          targetAmount: (value) => assertCopAmountValue(value, "targetAmount"),
          targetDate: (value) =>
            value === null ? undefined : assertValidIsoDate(value, "targetDate"),
          interestRatePercent: (value) => assertNullableNumber(value, "interestRatePercent"),
          iconName: (value) => assertNullableString(value, "iconName"),
          colorHex: (value) => assertNullableString(value, "colorHex"),
        })
      ),
  },
  {
    key: "goalContributions",
    validate: (row) =>
      assertRecordShape(
        row,
        "goalContributions",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          goalId: (value) => assertString(value, "goalId"),
          userId: (value) => assertString(value, "userId"),
          amount: (value) => assertCopAmountValue(value, "amount"),
          note: (value) => assertNullableString(value, "note"),
          date: (value) => assertValidIsoDate(value, "date"),
        })
      ),
  },
  {
    key: "captureEvidence",
    validate: (row) =>
      assertRecordShape(
        row,
        "captureEvidence",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          sourceFamily: (value) => assertString(value, "sourceFamily"),
          evidenceType: (value) =>
            assertOneOf(captureEvidenceTypeSchema.options, value, "evidenceType"),
          scope: (value) => assertString(value, "scope"),
          value: (value) => assertString(value, "value"),
          transactionId: (value) => assertNullableString(value, "transactionId"),
          transferId: (value) => assertNullableString(value, "transferId"),
          processedEmailId: (value) => assertNullableString(value, "processedEmailId"),
          processedCaptureId: (value) => assertNullableString(value, "processedCaptureId"),
          processedSourceEventId: (value) => assertNullableString(value, "processedSourceEventId"),
        }),
        ["processedSourceEventId"]
      ),
  },
  {
    key: "financialAccountIdentifiers",
    validate: (row) =>
      assertRecordShape(
        row,
        "financialAccountIdentifiers",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          accountId: (value) => assertString(value, "accountId"),
          scope: (value) => assertString(value, "scope"),
          value: (value) => assertString(value, "value"),
        })
      ),
  },
  {
    key: "accountSuggestionDismissals",
    validate: (row) =>
      assertRecordShape(
        row,
        "accountSuggestionDismissals",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          scope: (value) => assertString(value, "scope"),
          value: (value) => assertString(value, "value"),
          dismissedScore: (value) => assertCopAmountValue(value, "dismissedScore"),
        })
      ),
  },
  {
    key: "processedEmails",
    validate: (row) =>
      assertRecordShape(
        row,
        "processedEmails",
        {
          id: (value) => assertString(value, "id"),
          externalId: (value) => assertString(value, "externalId"),
          provider: (value) => assertString(value, "provider"),
          status: (value) => assertString(value, "status"),
          failureReason: (value) => assertNullableString(value, "failureReason"),
          subject: (value) => assertString(value, "subject"),
          rawBodyPreview: (value) => assertNullableString(value, "rawBodyPreview"),
          receivedAt: (value) => assertValidIsoDateTime(value, "receivedAt"),
          transactionId: (value) => assertNullableString(value, "transactionId"),
          confidence: (value) => assertNullableNumber(value, "confidence"),
          createdAt: (value) => assertValidIsoDateTime(value, "createdAt"),
          rawBody: (value) => assertNullableString(value, "rawBody"),
          retryCount: (value) => assertCopAmountValue(value, "retryCount"),
          nextRetryAt: (value) => assertNullableIsoDateTime(value, "nextRetryAt"),
        },
        ["rawBody", "retryCount", "nextRetryAt"]
      ),
  },
  ...INTAKE_ROW_SPECS,
] as const;
