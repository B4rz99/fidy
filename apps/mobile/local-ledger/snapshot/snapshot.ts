import { validateBackupSnapshot } from "./validation";
import { LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION } from "./version";

export { LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION, validateBackupSnapshot };

export type BackupSnapshot = {
  readonly version: typeof LOCAL_LEDGER_BACKUP_SNAPSHOT_VERSION;
  readonly exportedAt: string;
  readonly data: LocalLedgerBackupSnapshotData;
};

type SnapshotBaseRow = {
  readonly id: string;
};

type UserScopedSnapshotRow = SnapshotBaseRow & {
  readonly userId: string;
};

type SoftDeletedSnapshotRow = UserScopedSnapshotRow & {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
};

export type TransactionSnapshotRow = UserScopedSnapshotRow & {
  readonly type: string;
  readonly amount: number;
  readonly categoryId: string;
  readonly description: string | null;
  readonly counterpartyName: string | null;
  readonly date: string;
  readonly accountId: string;
  readonly accountAttributionState: string;
  readonly supersededAt: string | null;
  readonly supersededByTransferId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly voidedAt: string | null;
  readonly source: string;
};

export type TransferSnapshotRow = UserScopedSnapshotRow & {
  readonly amount: number;
  readonly fromAccountId: string | null;
  readonly toAccountId: string | null;
  readonly fromExternalLabel: string | null;
  readonly toExternalLabel: string | null;
  readonly description: string | null;
  readonly date: string;
  readonly source: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly voidedAt: string | null;
};

export type UserCategorySnapshotRow = SoftDeletedSnapshotRow & {
  readonly name: string;
  readonly iconName: string;
  readonly colorHex: string;
  readonly source?: string;
};

export type CategoryIconOverrideSnapshotRow = SoftDeletedSnapshotRow & {
  readonly categoryId: string;
  readonly emoji: string;
};

export type CategoryColorOverrideSnapshotRow = SoftDeletedSnapshotRow & {
  readonly categoryId: string;
  readonly colorHex: string;
};

export type FinancialAccountSnapshotRow = SoftDeletedSnapshotRow & {
  readonly name: string;
  readonly kind: string;
  readonly isDefault: boolean;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
  readonly source?: string;
};

export type OpeningBalanceSnapshotRow = SoftDeletedSnapshotRow & {
  readonly accountId: string;
  readonly amount: number;
  readonly effectiveDate: string;
};

export type BudgetSnapshotRow = SoftDeletedSnapshotRow & {
  readonly categoryId: string;
  readonly amount: number;
  readonly month: string;
};

export type GoalSnapshotRow = SoftDeletedSnapshotRow & {
  readonly name: string;
  readonly type: string;
  readonly targetAmount: number;
  readonly targetDate: string | null;
  readonly interestRatePercent: number | null;
  readonly iconName: string | null;
  readonly colorHex: string | null;
};

export type GoalContributionSnapshotRow = SoftDeletedSnapshotRow & {
  readonly goalId: string;
  readonly amount: number;
  readonly note: string | null;
  readonly date: string;
};

export type CaptureEvidenceSnapshotRow = SoftDeletedSnapshotRow & {
  readonly sourceFamily: string;
  readonly evidenceType: string;
  readonly scope: string;
  readonly value: string;
  readonly transactionId: string | null;
  readonly transferId: string | null;
  readonly processedSourceEventId: string | null;
};

export type FinancialAccountIdentifierSnapshotRow = SoftDeletedSnapshotRow & {
  readonly accountId: string;
  readonly scope: string;
  readonly value: string;
};

export type AccountSuggestionDismissalSnapshotRow = SoftDeletedSnapshotRow & {
  readonly scope: string;
  readonly value: string;
  readonly dismissedScore: number;
};

export type ProcessedSourceEventSnapshotRow = SoftDeletedSnapshotRow & {
  readonly sourceFamily: string;
  readonly sourceId: string;
  readonly sourceEventId: string;
  readonly status: string;
  readonly failureReason: string | null;
  readonly retryCount: number;
  readonly nextRetryAt: string | null;
  readonly transactionId: string | null;
  readonly confidence: number | null;
  readonly receivedAt: string;
  readonly processedAt: string;
};

export type ReviewCandidateSnapshotRow = SoftDeletedSnapshotRow & {
  readonly processedSourceEventId: string;
  readonly status: string;
  readonly candidateKind: string;
  readonly occurredAt: string | null;
  readonly amount: number | null;
  readonly currency: string;
  readonly transactionType: string | null;
  readonly categoryId: string | null;
  readonly description: string | null;
  readonly confidence: number | null;
};

export type ReviewCandidateCaptureEvidenceSnapshotRow = UserScopedSnapshotRow & {
  readonly reviewCandidateId: string;
  readonly captureEvidenceId: string;
  readonly createdAt: string;
  readonly deletedAt: string | null;
};

export type LocalLedgerBackupSnapshotData = {
  readonly transactions: readonly TransactionSnapshotRow[];
  readonly transfers: readonly TransferSnapshotRow[];
  readonly userCategories: readonly UserCategorySnapshotRow[];
  readonly categoryIconOverrides: readonly CategoryIconOverrideSnapshotRow[];
  readonly categoryColorOverrides: readonly CategoryColorOverrideSnapshotRow[];
  readonly financialAccounts: readonly FinancialAccountSnapshotRow[];
  readonly openingBalances: readonly OpeningBalanceSnapshotRow[];
  readonly budgets: readonly BudgetSnapshotRow[];
  readonly goals: readonly GoalSnapshotRow[];
  readonly goalContributions: readonly GoalContributionSnapshotRow[];
  readonly captureEvidence: readonly CaptureEvidenceSnapshotRow[];
  readonly financialAccountIdentifiers: readonly FinancialAccountIdentifierSnapshotRow[];
  readonly accountSuggestionDismissals: readonly AccountSuggestionDismissalSnapshotRow[];
  readonly processedSourceEvents: readonly ProcessedSourceEventSnapshotRow[];
  readonly reviewCandidates: readonly ReviewCandidateSnapshotRow[];
  readonly reviewCandidateCaptureEvidence: readonly ReviewCandidateCaptureEvidenceSnapshotRow[];
};
