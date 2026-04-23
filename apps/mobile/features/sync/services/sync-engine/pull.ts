// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnyDb } from "@/shared/db";
import { capturePipelineEvent } from "@/shared/lib";
import {
  advancePullCursor,
  capturePullFetchWarnings,
  countFetchedRows,
  fetchAllPullResults,
  getAllPullCursors,
} from "./cursor";
import { applyNonTransactionPullRows } from "./pull-non-transactions";
import { applyTransactionPullRows } from "./transaction-pull";
import type { NonTransactionPullOutcome, PullResults, TransactionPullOutcome } from "./types";

function captureSyncPullEvent(input: {
  results: PullResults;
  nonTransactionOutcome: NonTransactionPullOutcome;
  transactionOutcome: TransactionPullOutcome;
}) {
  capturePipelineEvent({
    source: "sync_pull",
    rowsFetched: countFetchedRows(input.results),
    rowsApplied:
      countFetchedRows(input.results) -
      input.nonTransactionOutcome.failedCount -
      input.transactionOutcome.failedCount,
    conflicts: input.transactionOutcome.conflictCount,
    failed: input.nonTransactionOutcome.failedCount + input.transactionOutcome.failedCount,
  });
}

function getSyncPullCursorAdvancements(input: {
  nonTransactionOutcome: NonTransactionPullOutcome;
  transactionSafeCursor: TransactionPullOutcome["safeCursor"];
}) {
  return [
    {
      tableName: "account_suggestion_dismissals" as const,
      cursor: input.nonTransactionOutcome.safeCursors.accountSuggestionDismissals,
    },
    {
      tableName: "capture_evidence" as const,
      cursor: input.nonTransactionOutcome.safeCursors.captureEvidence,
    },
    {
      tableName: "financial_accounts" as const,
      cursor: input.nonTransactionOutcome.safeCursors.financialAccounts,
    },
    { tableName: "transfers" as const, cursor: input.nonTransactionOutcome.safeCursors.transfers },
    {
      tableName: "opening_balances" as const,
      cursor: input.nonTransactionOutcome.safeCursors.openingBalances,
    },
    {
      tableName: "financial_account_identifiers" as const,
      cursor: input.nonTransactionOutcome.safeCursors.financialAccountIdentifiers,
    },
    { tableName: "transactions" as const, cursor: input.transactionSafeCursor },
  ];
}

async function advanceSyncPullCursors(input: {
  db: AnyDb;
  nonTransactionOutcome: NonTransactionPullOutcome;
  transactionSafeCursor: TransactionPullOutcome["safeCursor"];
}) {
  const cursorAdvancements = getSyncPullCursorAdvancements(input);
  await Promise.all(
    cursorAdvancements.map(({ tableName, cursor }) =>
      advancePullCursor(input.db, tableName, cursor)
    )
  );
}

export async function syncPull(
  db: AnyDb,
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const cursors = await getAllPullCursors(db);
  const results = await fetchAllPullResults({ supabase, userId, cursors });
  const nonTransactionOutcome = applyNonTransactionPullRows(db, results);
  const transactionOutcome = await applyTransactionPullRows(db, results.transactions.rows);

  capturePullFetchWarnings(results);
  captureSyncPullEvent({ results, nonTransactionOutcome, transactionOutcome });
  await advanceSyncPullCursors({
    db,
    nonTransactionOutcome,
    transactionSafeCursor: transactionOutcome.safeCursor,
  });

  return results.transactions.error == null;
}
