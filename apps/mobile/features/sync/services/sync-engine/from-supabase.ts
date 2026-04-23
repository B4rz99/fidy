// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import {
  getAccountSuggestionDismissalById,
  type upsertAccountSuggestionDismissal,
} from "@/features/account-suggestions/lib/dismissals-repository";
import {
  getCaptureEvidenceById,
  type upsertCaptureEvidence,
} from "@/features/capture-evidence/lib/repository";
import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/lib/default-account";
import {
  getFinancialAccountIdentifierById,
  type upsertFinancialAccountIdentifier,
} from "@/features/financial-accounts/lib/identifiers-repository";
import {
  getOpeningBalanceById,
  type upsertOpeningBalance,
} from "@/features/financial-accounts/lib/opening-balances-repository";
import {
  getFinancialAccountById,
  type upsertFinancialAccount,
} from "@/features/financial-accounts/lib/repository";
import { getTransferById, type upsertTransfer } from "@/features/transfers/lib/repository";
import type { AnyDb } from "@/shared/db";
import type {
  SupabaseAccountSuggestionDismissalRow,
  SupabaseCaptureEvidenceRow,
  SupabaseFinancialAccountIdentifierRow,
  SupabaseFinancialAccountRow,
  SupabaseOpeningBalanceRow,
  SupabaseTransactionRow,
  SupabaseTransferRow,
} from "./types";

export const shouldUpdateLocal = (
  serverUpdatedAt: string,
  localUpdatedAt: string | undefined
): boolean => !localUpdatedAt || serverUpdatedAt > localUpdatedAt;

function fromSupabaseTransactionAccountDefaults(row: SupabaseTransactionRow) {
  return {
    accountId: row.account_id ?? buildDefaultFinancialAccountId(row.user_id),
    accountAttributionState: row.account_attribution_state ?? "confirmed",
  };
}

function fromSupabaseTransactionNullableFields(row: SupabaseTransactionRow) {
  return {
    supersededAt: row.superseded_at ?? null,
    deletedAt: row.deleted_at ?? null,
  };
}

export function fromSupabaseTransactionRow(row: SupabaseTransactionRow) {
  const accountDefaults = fromSupabaseTransactionAccountDefaults(row);
  const nullableFields = fromSupabaseTransactionNullableFields(row);
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    categoryId: row.category_id,
    accountId: accountDefaults.accountId,
    accountAttributionState: accountDefaults.accountAttributionState,
    supersededAt: nullableFields.supersededAt,
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: nullableFields.deletedAt,
  };
}

export function fromSupabaseFinancialAccountRow(
  row: SupabaseFinancialAccountRow
): Parameters<typeof upsertFinancialAccount>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    isDefault: row.is_default,
    statementClosingDay: row.statement_closing_day,
    paymentDueDay: row.payment_due_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertFinancialAccount>[1];
}

export function fromSupabaseTransferRow(
  row: SupabaseTransferRow
): Parameters<typeof upsertTransfer>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    fromExternalLabel: row.from_external_label,
    toExternalLabel: row.to_external_label,
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertTransfer>[1];
}

export function fromSupabaseOpeningBalanceRow(
  row: SupabaseOpeningBalanceRow
): Parameters<typeof upsertOpeningBalance>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    amount: row.amount,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertOpeningBalance>[1];
}

export function fromSupabaseFinancialAccountIdentifierRow(
  row: SupabaseFinancialAccountIdentifierRow
): Parameters<typeof upsertFinancialAccountIdentifier>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    scope: row.scope,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertFinancialAccountIdentifier>[1];
}

export function fromSupabaseCaptureEvidenceRow(
  row: SupabaseCaptureEvidenceRow
): Parameters<typeof upsertCaptureEvidence>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    sourceFamily: row.source_family,
    evidenceType: row.evidence_type,
    scope: row.scope,
    value: row.value,
    transactionId: row.transaction_id,
    transferId: row.transfer_id ?? null,
    processedEmailId: row.processed_email_id,
    processedCaptureId: row.processed_capture_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertCaptureEvidence>[1];
}

export function fromSupabaseAccountSuggestionDismissalRow(
  row: SupabaseAccountSuggestionDismissalRow
): Parameters<typeof upsertAccountSuggestionDismissal>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    scope: row.scope,
    value: row.value,
    dismissedScore: row.dismissed_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertAccountSuggestionDismissal>[1];
}

export function getLocalAccountSuggestionDismissalRow(database: AnyDb, rowId: string) {
  return getAccountSuggestionDismissalById(
    database,
    rowId as Parameters<typeof getAccountSuggestionDismissalById>[1]
  );
}

export function getLocalCaptureEvidenceRow(database: AnyDb, rowId: string) {
  return getCaptureEvidenceById(database, rowId as Parameters<typeof getCaptureEvidenceById>[1]);
}

export function getLocalFinancialAccountRow(database: AnyDb, rowId: string) {
  return getFinancialAccountById(database, rowId as Parameters<typeof getFinancialAccountById>[1]);
}

export function getLocalTransferRow(database: AnyDb, rowId: string) {
  return getTransferById(database, rowId as Parameters<typeof getTransferById>[1]);
}

export function getLocalOpeningBalanceRow(database: AnyDb, rowId: string) {
  return getOpeningBalanceById(database, rowId as Parameters<typeof getOpeningBalanceById>[1]);
}

export function getLocalFinancialAccountIdentifierRow(database: AnyDb, rowId: string) {
  return getFinancialAccountIdentifierById(
    database,
    rowId as Parameters<typeof getFinancialAccountIdentifierById>[1]
  );
}
