// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import type { SupabaseClient } from "@supabase/supabase-js";
import type { getAccountSuggestionDismissalById } from "@/features/account-suggestions/lib/dismissals-repository";
import type { getBudgetById } from "@/features/budget/lib/repository";
import type { getCaptureEvidenceById } from "@/features/capture-evidence/lib/repository";
import type { getFinancialAccountIdentifierById } from "@/features/financial-accounts/lib/identifiers-repository";
import type { getOpeningBalanceById } from "@/features/financial-accounts/lib/opening-balances-repository";
import type { getFinancialAccountById } from "@/features/financial-accounts/lib/repository";
import type { getContributionById, getGoalById } from "@/features/goals/lib/repository";
import type { getTransactionById } from "@/features/transactions/lib/repository";
import type { getTransferById } from "@/features/transfers/lib/repository";
import type { AnyDb } from "@/shared/db";

export const LEGACY_LAST_SYNC_AT = "last_sync_at";
export const LAST_SYNC_AT_BY_TABLE = {
  transactions: "last_sync_at_transactions",
  account_suggestion_dismissals: "last_sync_at_account_suggestion_dismissals",
  capture_evidence: "last_sync_at_capture_evidence",
  financial_accounts: "last_sync_at_financial_accounts",
  transfers: "last_sync_at_transfers",
  opening_balances: "last_sync_at_opening_balances",
  financial_account_identifiers: "last_sync_at_financial_account_identifiers",
} as const;
export const PULL_PAGE_SIZE = 1000;

export type RemoteFinancialSyncMode = "legacy" | "privateBackup";
export type SyncPushOptions = {
  readonly remoteFinancialSync?: RemoteFinancialSyncMode;
};
export type SyncPullOptions = {
  readonly remoteFinancialSync?: RemoteFinancialSyncMode;
};
export type SyncPushRequest = {
  readonly userId: string;
  readonly remoteFinancialSync?: RemoteFinancialSyncMode;
};

export type SupabaseTransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  category_id: string;
  account_id?: string;
  account_attribution_state?: string;
  superseded_at?: string | null;
  description: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseFinancialAccountRow = {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  is_default: boolean;
  statement_closing_day: number | null;
  payment_due_day: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseTransferRow = {
  id: string;
  user_id: string;
  amount: number;
  from_account_id: string | null;
  to_account_id: string | null;
  from_external_label: string | null;
  to_external_label: string | null;
  description: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseOpeningBalanceRow = {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseFinancialAccountIdentifierRow = {
  id: string;
  user_id: string;
  account_id: string;
  scope: string;
  value: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseCaptureEvidenceRow = {
  id: string;
  user_id: string;
  source_family: string;
  evidence_type: string;
  scope: string;
  value: string;
  transaction_id: string | null;
  transfer_id?: string | null;
  processed_email_id: string | null;
  processed_capture_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseAccountSuggestionDismissalRow = {
  id: string;
  user_id: string;
  scope: string;
  value: string;
  dismissed_score: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PullTableName = keyof typeof LAST_SYNC_AT_BY_TABLE;
export type PullCursor = { updatedAt: string; id: string | null };
export type PullFetchResponse<TRow extends { updated_at: string; id: string }> = {
  data: TRow[] | null;
  error: { message?: string; code?: string } | null;
};
export type PullFetchOutcome<TRow extends { updated_at: string; id: string }> = {
  tableName: PullTableName;
  rows: TRow[];
  error: { message: string; code: string } | null;
};
export type PushEntryContext = {
  db: AnyDb;
  supabase: SupabaseClient;
  rowId: string;
};
export type PushEntryOutcome =
  | { ok: true }
  | { ok: false; errorMessage: string; errorCode: string };
export type PushEntryHandler = (context: PushEntryContext) => Promise<PushEntryOutcome>;
export type UpsertPushSpec<TRow, TSupabaseRow> = {
  tableName: string;
  getRow: (db: AnyDb, rowId: string) => TRow | null | Promise<TRow | null>;
  mapRow: (row: TRow) => TSupabaseRow;
  upsertOptions?: { onConflict: string };
};
export type PullFetchRequest = {
  supabase: SupabaseClient;
  userId: string;
  tableName: string;
  lastSyncAt: PullCursor | null;
};
export type ApplyServerRowsRequest<
  TRow extends { id: string; updated_at: string },
  TMappedRow,
  TLocalRow extends { updatedAt: string } | null,
> = {
  db: AnyDb;
  rows: readonly TRow[];
  getLocalRow: (db: AnyDb, rowId: string) => TLocalRow;
  upsertLocalRow: (db: AnyDb, row: TMappedRow) => void;
  mapServerRow: (row: TRow) => TMappedRow;
};

export type LocalTransactionRow = NonNullable<Awaited<ReturnType<typeof getTransactionById>>>;
export type LocalBudgetRow = NonNullable<ReturnType<typeof getBudgetById>>;
export type LocalGoalRow = NonNullable<ReturnType<typeof getGoalById>>;
export type LocalFinancialAccountRow = NonNullable<ReturnType<typeof getFinancialAccountById>>;
export type LocalTransferRow = NonNullable<ReturnType<typeof getTransferById>>;
export type LocalOpeningBalanceRow = NonNullable<ReturnType<typeof getOpeningBalanceById>>;
export type LocalFinancialAccountIdentifierRow = NonNullable<
  ReturnType<typeof getFinancialAccountIdentifierById>
>;
export type LocalCaptureEvidenceRow = NonNullable<ReturnType<typeof getCaptureEvidenceById>>;
export type LocalAccountSuggestionDismissalRow = NonNullable<
  ReturnType<typeof getAccountSuggestionDismissalById>
>;
export type LocalContributionRow = NonNullable<ReturnType<typeof getContributionById>>;

export type PullCursorState = {
  accountSuggestionDismissals: PullCursor | null;
  captureEvidence: PullCursor | null;
  financialAccounts: PullCursor | null;
  transfers: PullCursor | null;
  openingBalances: PullCursor | null;
  financialAccountIdentifiers: PullCursor | null;
  transactions: PullCursor | null;
};

export type PullResults = {
  accountSuggestionDismissals: PullFetchOutcome<SupabaseAccountSuggestionDismissalRow>;
  captureEvidence: PullFetchOutcome<SupabaseCaptureEvidenceRow>;
  financialAccounts: PullFetchOutcome<SupabaseFinancialAccountRow>;
  transfers: PullFetchOutcome<SupabaseTransferRow>;
  openingBalances: PullFetchOutcome<SupabaseOpeningBalanceRow>;
  financialAccountIdentifiers: PullFetchOutcome<SupabaseFinancialAccountIdentifierRow>;
  transactions: PullFetchOutcome<SupabaseTransactionRow>;
};

export type NonTransactionPullOutcome = {
  failedCount: number;
  safeCursors: {
    accountSuggestionDismissals: PullCursor | null;
    captureEvidence: PullCursor | null;
    financialAccounts: PullCursor | null;
    transfers: PullCursor | null;
    openingBalances: PullCursor | null;
    financialAccountIdentifiers: PullCursor | null;
  };
};

export type TransactionPullOutcome = {
  failedCount: number;
  conflictCount: number;
  safeCursor: PullCursor | null;
};

export type ComparableTransactionRow = ReturnType<
  typeof import("./from-supabase").fromSupabaseTransactionRow
>;
export type MaybeLocalTransactionRow = Awaited<ReturnType<typeof getTransactionById>>;
