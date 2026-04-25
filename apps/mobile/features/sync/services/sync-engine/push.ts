// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountSuggestionDismissalById } from "@/features/account-suggestions/lib/dismissals-repository";
import { getBudgetById } from "@/features/budget/lib/repository";
import { getCaptureEvidenceById } from "@/features/capture-evidence/lib/repository";
import { getFinancialAccountIdentifierById } from "@/features/financial-accounts/lib/identifiers-repository";
import { getOpeningBalanceById } from "@/features/financial-accounts/lib/opening-balances-repository";
import { getFinancialAccountById } from "@/features/financial-accounts/lib/repository";
import { getContributionById, getGoalById } from "@/features/goals/lib/repository";
import {
  clearSyncEntries,
  getQueuedSyncEntries,
  getTransactionById,
} from "@/features/transactions/lib/repository";
import { getTransferById } from "@/features/transfers/lib/repository";
import type { AnyDb } from "@/shared/db";
import { capturePipelineEvent, captureWarning } from "@/shared/lib";
import { requireBudgetId, requireTransactionId } from "@/shared/types/assertions";
import type { SyncQueueId } from "@/shared/types/branded";
import {
  toPushEntryFailure,
  toSupabaseAccountSuggestionDismissalRow,
  toSupabaseBudgetRow,
  toSupabaseCaptureEvidenceRow,
  toSupabaseContributionRow,
  toSupabaseFinancialAccountIdentifierRow,
  toSupabaseFinancialAccountRow,
  toSupabaseGoalRow,
  toSupabaseOpeningBalanceRow,
  toSupabaseTransactionRow,
  toSupabaseTransferRow,
} from "./to-supabase";
import type {
  PushEntryContext,
  PushEntryHandler,
  PushEntryOutcome,
  SyncPushOptions,
  UpsertPushSpec,
} from "./types";

const PUSH_ENTRY_PROCESSED: PushEntryOutcome = { ok: true };
const PRIVATE_BACKUP_SYNC_MODE = "privateBackup";
const PLAINTEXT_FINANCIAL_PUSH_TABLES = new Set<string>([
  "transactions",
  "budgets",
  "goals",
  "financialAccounts",
  "transfers",
  "openingBalances",
  "financialAccountIdentifiers",
  "captureEvidence",
  "accountSuggestionDismissals",
  "goalContributions",
]);

async function upsertPushRow<TRow, TSupabaseRow>(
  context: PushEntryContext,
  spec: UpsertPushSpec<TRow, TSupabaseRow>
): Promise<PushEntryOutcome> {
  const row = await spec.getRow(context.db, context.rowId);
  if (!row) {
    return PUSH_ENTRY_PROCESSED;
  }

  const query = context.supabase.from(spec.tableName);
  const payload = spec.mapRow(row);
  const response = spec.upsertOptions
    ? await query.upsert(payload, spec.upsertOptions)
    : await query.upsert(payload);

  return response.error ? toPushEntryFailure(response.error) : PUSH_ENTRY_PROCESSED;
}

const processTransactionEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "transactions",
    getRow: (db, rowId) => getTransactionById(db, requireTransactionId(rowId)),
    mapRow: toSupabaseTransactionRow,
  });

const processBudgetEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "budgets",
    getRow: (db, rowId) => getBudgetById(db, requireBudgetId(rowId)),
    mapRow: toSupabaseBudgetRow,
  });

const processGoalEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "goals",
    getRow: (db, rowId) => getGoalById(db, rowId),
    mapRow: toSupabaseGoalRow,
  });

const processFinancialAccountEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "financial_accounts",
    getRow: (db, rowId) =>
      getFinancialAccountById(db, rowId as Parameters<typeof getFinancialAccountById>[1]),
    mapRow: toSupabaseFinancialAccountRow,
  });

const processTransferEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "transfers",
    getRow: (db, rowId) => getTransferById(db, rowId as Parameters<typeof getTransferById>[1]),
    mapRow: toSupabaseTransferRow,
  });

const processOpeningBalanceEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "opening_balances",
    getRow: (db, rowId) =>
      getOpeningBalanceById(db, rowId as Parameters<typeof getOpeningBalanceById>[1]),
    mapRow: toSupabaseOpeningBalanceRow,
    upsertOptions: { onConflict: "account_id" },
  });

const processFinancialAccountIdentifierEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "financial_account_identifiers",
    getRow: (db, rowId) =>
      getFinancialAccountIdentifierById(
        db,
        rowId as Parameters<typeof getFinancialAccountIdentifierById>[1]
      ),
    mapRow: toSupabaseFinancialAccountIdentifierRow,
    upsertOptions: { onConflict: "user_id,account_id,scope,value" },
  });

const processCaptureEvidenceEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "capture_evidence",
    getRow: (db, rowId) =>
      getCaptureEvidenceById(db, rowId as Parameters<typeof getCaptureEvidenceById>[1]),
    mapRow: toSupabaseCaptureEvidenceRow,
  });

const processAccountSuggestionDismissalEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "account_suggestion_dismissals",
    getRow: (db, rowId) =>
      getAccountSuggestionDismissalById(
        db,
        rowId as Parameters<typeof getAccountSuggestionDismissalById>[1]
      ),
    mapRow: toSupabaseAccountSuggestionDismissalRow,
    upsertOptions: { onConflict: "user_id,scope,value" },
  });

const processContributionEntry: PushEntryHandler = (context) =>
  upsertPushRow(context, {
    tableName: "goal_contributions",
    getRow: (db, rowId) => getContributionById(db, rowId),
    mapRow: toSupabaseContributionRow,
  });

const PUSH_ENTRY_HANDLERS = {
  transactions: processTransactionEntry,
  budgets: processBudgetEntry,
  financialAccounts: processFinancialAccountEntry,
  accountSuggestionDismissals: processAccountSuggestionDismissalEntry,
  captureEvidence: processCaptureEvidenceEntry,
  transfers: processTransferEntry,
  openingBalances: processOpeningBalanceEntry,
  financialAccountIdentifiers: processFinancialAccountIdentifierEntry,
  goals: processGoalEntry,
  goalContributions: processContributionEntry,
} satisfies Record<string, PushEntryHandler>;

function getPushEntryHandler(tableName: string): PushEntryHandler | null {
  return PUSH_ENTRY_HANDLERS[tableName as keyof typeof PUSH_ENTRY_HANDLERS] ?? null;
}

function capturePushEntryFailure(
  tableName: string,
  outcome: Extract<PushEntryOutcome, { ok: false }>
) {
  captureWarning("sync_push_entry_failed", {
    tableName,
    errorMessage: outcome.errorMessage,
    errorCode: outcome.errorCode,
  });
}

function hasRejectedPushErrorFields(
  reason: unknown
): reason is { message?: unknown; code?: unknown } {
  return typeof reason === "object" && reason !== null;
}

function readRejectedPushErrorMessage(reason: unknown) {
  if (typeof reason === "string") {
    return reason;
  }

  if (!hasRejectedPushErrorFields(reason)) {
    return "unknown";
  }

  return typeof reason.message === "string" ? reason.message : "unknown";
}

function readRejectedPushErrorCode(reason: unknown) {
  if (!hasRejectedPushErrorFields(reason)) {
    return "unknown";
  }

  return typeof reason.code === "string" ? reason.code : "unknown";
}

function toRejectedPushWarningPayload(
  entry: { tableName: string; rowId: string } | undefined,
  reason: unknown
) {
  return {
    tableName: entry?.tableName ?? "unknown",
    rowId: entry?.rowId ?? "unknown",
    errorMessage: readRejectedPushErrorMessage(reason),
    errorCode: readRejectedPushErrorCode(reason),
  };
}

function captureRejectedPushEntries(
  entries: readonly { tableName: string; rowId: string }[],
  results: readonly PromiseSettledResult<SyncQueueId | null>[]
) {
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      return;
    }

    captureWarning(
      "sync_push_entry_failed",
      toRejectedPushWarningPayload(entries[index], result.reason)
    );
  });
}

async function processEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  entry: { id: SyncQueueId; tableName: string; rowId: string },
  options: SyncPushOptions
): Promise<SyncQueueId | null> {
  if (
    options.remoteFinancialSync === PRIVATE_BACKUP_SYNC_MODE &&
    PLAINTEXT_FINANCIAL_PUSH_TABLES.has(entry.tableName)
  ) {
    return entry.id;
  }

  const handler = getPushEntryHandler(entry.tableName);
  if (!handler) {
    captureWarning("sync_push_unknown_table", { tableName: entry.tableName });
    return null;
  }

  const outcome = await handler({ db, supabase, rowId: entry.rowId });
  if (!outcome.ok) {
    capturePushEntryFailure(entry.tableName, outcome);
  }
  return outcome.ok ? entry.id : null;
}

export async function syncPush(
  db: AnyDb,
  supabase: SupabaseClient,
  _userId: string,
  options: SyncPushOptions = { remoteFinancialSync: "legacy" }
): Promise<void> {
  const entries = await getQueuedSyncEntries(db);
  if (entries.length === 0) return;

  const results = await Promise.allSettled(
    entries.map((entry) => processEntry(db, supabase, entry, options))
  );
  captureRejectedPushEntries(entries, results);
  const processedIds = results
    .filter(
      (result): result is PromiseFulfilledResult<SyncQueueId> =>
        result.status === "fulfilled" && result.value !== null
    )
    .map((result) => result.value);

  if (processedIds.length > 0) {
    await clearSyncEntries(db, processedIds);
  }

  capturePipelineEvent({
    source: "sync_push",
    queued: entries.length,
    succeeded: processedIds.length,
    failed: entries.length - processedIds.length,
  });
}
