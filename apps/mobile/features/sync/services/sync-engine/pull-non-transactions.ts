// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import { upsertAccountSuggestionDismissal } from "@/features/account-suggestions/lib/dismissals-repository";
import { upsertCaptureEvidence } from "@/features/capture-evidence/lib/repository";
import { upsertFinancialAccountIdentifier } from "@/features/financial-accounts/lib/identifiers-repository";
import { upsertOpeningBalance } from "@/features/financial-accounts/lib/opening-balances-repository";
import { upsertFinancialAccount } from "@/features/financial-accounts/lib/repository";
import { upsertTransfer } from "@/features/transfers/lib/repository";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import { rowToPullCursor } from "./cursor";
import {
  fromSupabaseAccountSuggestionDismissalRow,
  fromSupabaseCaptureEvidenceRow,
  fromSupabaseFinancialAccountIdentifierRow,
  fromSupabaseFinancialAccountRow,
  fromSupabaseOpeningBalanceRow,
  fromSupabaseTransferRow,
  getLocalAccountSuggestionDismissalRow,
  getLocalCaptureEvidenceRow,
  getLocalFinancialAccountIdentifierRow,
  getLocalFinancialAccountRow,
  getLocalOpeningBalanceRow,
  getLocalTransferRow,
  shouldUpdateLocal,
} from "./from-supabase";
import type {
  ApplyServerRowsRequest,
  NonTransactionPullOutcome,
  PullCursor,
  PullResults,
  SupabaseAccountSuggestionDismissalRow,
  SupabaseCaptureEvidenceRow,
  SupabaseFinancialAccountIdentifierRow,
  SupabaseFinancialAccountRow,
  SupabaseOpeningBalanceRow,
  SupabaseTransferRow,
} from "./types";

function applyServerRows<
  TRow extends { id: string; updated_at: string },
  TMappedRow,
  TLocalRow extends { updatedAt: string } | null,
>(request: ApplyServerRowsRequest<TRow, TMappedRow, TLocalRow>) {
  let failedCount = 0;
  let safeCursor: PullCursor | null = null;
  let sawFailure = false;

  for (const serverRow of request.rows) {
    try {
      const localRow = request.getLocalRow(request.db, serverRow.id);
      if (shouldUpdateLocal(serverRow.updated_at, localRow?.updatedAt)) {
        request.upsertLocalRow(request.db, request.mapServerRow(serverRow));
      }
      if (!sawFailure) {
        safeCursor = rowToPullCursor(serverRow);
      }
    } catch (error) {
      captureError(error);
      failedCount++;
      sawFailure = true;
    }
  }

  return { failedCount, safeCursor };
}

function applyAccountSuggestionDismissalRows(
  db: AnyDb,
  rows: SupabaseAccountSuggestionDismissalRow[]
) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalAccountSuggestionDismissalRow,
    upsertLocalRow: upsertAccountSuggestionDismissal,
    mapServerRow: fromSupabaseAccountSuggestionDismissalRow,
  });
}

function applyCaptureEvidenceRows(db: AnyDb, rows: SupabaseCaptureEvidenceRow[]) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalCaptureEvidenceRow,
    upsertLocalRow: upsertCaptureEvidence,
    mapServerRow: fromSupabaseCaptureEvidenceRow,
  });
}

function applyFinancialAccountRows(db: AnyDb, rows: SupabaseFinancialAccountRow[]) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalFinancialAccountRow,
    upsertLocalRow: upsertFinancialAccount,
    mapServerRow: fromSupabaseFinancialAccountRow,
  });
}

function applyTransferRows(db: AnyDb, rows: SupabaseTransferRow[]) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalTransferRow,
    upsertLocalRow: upsertTransfer,
    mapServerRow: fromSupabaseTransferRow,
  });
}

function applyOpeningBalanceRows(db: AnyDb, rows: SupabaseOpeningBalanceRow[]) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalOpeningBalanceRow,
    upsertLocalRow: upsertOpeningBalance,
    mapServerRow: fromSupabaseOpeningBalanceRow,
  });
}

function applyFinancialAccountIdentifierRows(
  db: AnyDb,
  rows: SupabaseFinancialAccountIdentifierRow[]
) {
  return applyServerRows({
    db,
    rows,
    getLocalRow: getLocalFinancialAccountIdentifierRow,
    upsertLocalRow: upsertFinancialAccountIdentifier,
    mapServerRow: fromSupabaseFinancialAccountIdentifierRow,
  });
}

type NonTransactionRowOutcomes = {
  accountSuggestionDismissals: ReturnType<typeof applyAccountSuggestionDismissalRows>;
  captureEvidence: ReturnType<typeof applyCaptureEvidenceRows>;
  financialAccounts: ReturnType<typeof applyFinancialAccountRows>;
  transfers: ReturnType<typeof applyTransferRows>;
  openingBalances: ReturnType<typeof applyOpeningBalanceRows>;
  financialAccountIdentifiers: ReturnType<typeof applyFinancialAccountIdentifierRows>;
};

function countNonTransactionFailedRows(outcomes: NonTransactionRowOutcomes) {
  return (
    outcomes.accountSuggestionDismissals.failedCount +
    outcomes.captureEvidence.failedCount +
    outcomes.financialAccounts.failedCount +
    outcomes.transfers.failedCount +
    outcomes.openingBalances.failedCount +
    outcomes.financialAccountIdentifiers.failedCount
  );
}

function getNonTransactionSafeCursors(outcomes: NonTransactionRowOutcomes) {
  return {
    accountSuggestionDismissals: outcomes.accountSuggestionDismissals.safeCursor,
    captureEvidence: outcomes.captureEvidence.safeCursor,
    financialAccounts: outcomes.financialAccounts.safeCursor,
    transfers: outcomes.transfers.safeCursor,
    openingBalances: outcomes.openingBalances.safeCursor,
    financialAccountIdentifiers: outcomes.financialAccountIdentifiers.safeCursor,
  };
}

export function applyNonTransactionPullRows(
  db: AnyDb,
  results: PullResults
): NonTransactionPullOutcome {
  const outcomes: NonTransactionRowOutcomes = {
    accountSuggestionDismissals: applyAccountSuggestionDismissalRows(
      db,
      results.accountSuggestionDismissals.rows
    ),
    captureEvidence: applyCaptureEvidenceRows(db, results.captureEvidence.rows),
    financialAccounts: applyFinancialAccountRows(db, results.financialAccounts.rows),
    transfers: applyTransferRows(db, results.transfers.rows),
    openingBalances: applyOpeningBalanceRows(db, results.openingBalances.rows),
    financialAccountIdentifiers: applyFinancialAccountIdentifierRows(
      db,
      results.financialAccountIdentifiers.rows
    ),
  };

  return {
    failedCount: countNonTransactionFailedRows(outcomes),
    safeCursors: getNonTransactionSafeCursors(outcomes),
  };
}
