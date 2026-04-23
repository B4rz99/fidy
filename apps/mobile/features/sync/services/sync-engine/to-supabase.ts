// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/lib/default-account";
import type {
  LocalAccountSuggestionDismissalRow,
  LocalBudgetRow,
  LocalCaptureEvidenceRow,
  LocalContributionRow,
  LocalFinancialAccountIdentifierRow,
  LocalFinancialAccountRow,
  LocalGoalRow,
  LocalOpeningBalanceRow,
  LocalTransactionRow,
  LocalTransferRow,
  PushEntryOutcome,
  SupabaseTransactionRow,
} from "./types";

export function toPushEntryFailure(error: { message?: string; code?: string }): PushEntryOutcome {
  return {
    ok: false,
    errorMessage: error.message ?? "unknown",
    errorCode: error.code ?? "unknown",
  };
}

export function toSupabaseTransactionAccountDefaults(row: LocalTransactionRow) {
  return {
    accountId: row.accountId ?? buildDefaultFinancialAccountId(row.userId),
    accountAttributionState: row.accountAttributionState ?? "confirmed",
  };
}

export function toSupabaseTransactionDeleteFields(row: LocalTransactionRow) {
  return {
    supersededAt: row.supersededAt ?? null,
    deletedAt: row.deletedAt ?? null,
  };
}

export function toSupabaseTransactionDescription(row: LocalTransactionRow) {
  return row.description ?? null;
}

export function toSupabaseTransactionRow(row: LocalTransactionRow): SupabaseTransactionRow {
  const accountDefaults = toSupabaseTransactionAccountDefaults(row);
  const deleteFields = toSupabaseTransactionDeleteFields(row);
  const description = toSupabaseTransactionDescription(row);
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type,
    amount: row.amount,
    category_id: row.categoryId,
    account_id: accountDefaults.accountId,
    account_attribution_state: accountDefaults.accountAttributionState,
    superseded_at: deleteFields.supersededAt,
    description,
    date: row.date,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: deleteFields.deletedAt,
  };
}

export const toSupabaseBudgetRow = (row: LocalBudgetRow) => ({
  id: row.id,
  user_id: row.userId,
  category_id: row.categoryId,
  amount: row.amount,
  month: row.month,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

export const toSupabaseGoalRow = (row: LocalGoalRow) => ({
  id: row.id,
  user_id: row.userId,
  name: row.name,
  type: row.type,
  target_amount: row.targetAmount,
  target_date: row.targetDate,
  interest_rate_percent: row.interestRatePercent,
  icon_name: row.iconName,
  color_hex: row.colorHex,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

const toSupabaseFinancialAccountDays = (row: LocalFinancialAccountRow) => ({
  statementClosingDay: row.statementClosingDay ?? null,
  paymentDueDay: row.paymentDueDay ?? null,
});

export const toSupabaseFinancialAccountRow = (row: LocalFinancialAccountRow) => {
  const days = toSupabaseFinancialAccountDays(row);
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    kind: row.kind,
    is_default: row.isDefault,
    statement_closing_day: days.statementClosingDay,
    payment_due_day: days.paymentDueDay,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  };
};

export const toSupabaseTransferRow = (row: LocalTransferRow) => ({
  id: row.id,
  user_id: row.userId,
  amount: row.amount,
  from_account_id: row.fromAccountId,
  to_account_id: row.toAccountId,
  from_external_label: row.fromExternalLabel,
  to_external_label: row.toExternalLabel,
  description: row.description,
  date: row.date,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

export const toSupabaseOpeningBalanceRow = (row: LocalOpeningBalanceRow) => ({
  id: row.id,
  user_id: row.userId,
  account_id: row.accountId,
  amount: row.amount,
  effective_date: row.effectiveDate,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

export const toSupabaseFinancialAccountIdentifierRow = (
  row: LocalFinancialAccountIdentifierRow
) => ({
  id: row.id,
  user_id: row.userId,
  account_id: row.accountId,
  scope: row.scope,
  value: row.value,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

export const toSupabaseCaptureEvidenceRow = (row: LocalCaptureEvidenceRow) => ({
  id: row.id,
  user_id: row.userId,
  source_family: row.sourceFamily,
  evidence_type: row.evidenceType,
  scope: row.scope,
  value: row.value,
  transaction_id: row.transactionId,
  transfer_id: row.transferId ?? null,
  processed_email_id: row.processedEmailId,
  processed_capture_id: row.processedCaptureId,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

export const toSupabaseAccountSuggestionDismissalRow = (
  row: LocalAccountSuggestionDismissalRow
) => ({
  id: row.id,
  user_id: row.userId,
  scope: row.scope,
  value: row.value,
  dismissed_score: row.dismissedScore,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});

export const toSupabaseContributionRow = (row: LocalContributionRow) => ({
  id: row.id,
  goal_id: row.goalId,
  user_id: row.userId,
  amount: row.amount,
  note: row.note,
  date: row.date,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  deleted_at: row.deletedAt,
});
