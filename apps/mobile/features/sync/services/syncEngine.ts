// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBudgetById } from "@/features/budget";
import {
  buildDefaultFinancialAccountId,
  getFinancialAccountById,
  getFinancialAccountIdentifierById,
  getOpeningBalanceById,
  upsertFinancialAccount,
  upsertFinancialAccountIdentifier,
  upsertOpeningBalance,
} from "@/features/financial-accounts";
import { getContributionById, getGoalById } from "@/features/goals";
import {
  clearSyncEntries,
  getQueuedSyncEntries,
  getSyncMeta,
  getTransactionById,
  setSyncMeta,
  upsertTransaction,
} from "@/features/transactions";
import { getTransferById, upsertTransfer } from "@/features/transfers";
import type { AnyDb } from "@/shared/db";
import {
  captureError,
  capturePipelineEvent,
  captureWarning,
  generateSyncConflictId,
  toIsoDateTime,
} from "@/shared/lib";
import { requireBudgetId, requireTransactionId } from "@/shared/types/assertions";
import type { SyncQueueId } from "@/shared/types/branded";
import { hasDataConflict } from "../lib/conflict-detection";
import { insertConflict } from "../lib/conflict-repository";

const LEGACY_LAST_SYNC_AT = "last_sync_at";
const LAST_SYNC_AT_BY_TABLE = {
  transactions: "last_sync_at_transactions",
  financial_accounts: "last_sync_at_financial_accounts",
  transfers: "last_sync_at_transfers",
  opening_balances: "last_sync_at_opening_balances",
  financial_account_identifiers: "last_sync_at_financial_account_identifiers",
} as const;
const PULL_PAGE_SIZE = 1000;

type SupabaseTransactionRow = {
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

type SupabaseFinancialAccountRow = {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SupabaseTransferRow = {
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

type SupabaseOpeningBalanceRow = {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SupabaseFinancialAccountIdentifierRow = {
  id: string;
  user_id: string;
  account_id: string;
  scope: string;
  value: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toSupabaseRow(row: {
  id: string;
  userId: string;
  type: string;
  amount: number;
  categoryId: string;
  accountId?: string;
  accountAttributionState?: string;
  supersededAt?: string | null;
  description?: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}): SupabaseTransactionRow {
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type,
    amount: row.amount,
    category_id: row.categoryId,
    account_id: row.accountId ?? buildDefaultFinancialAccountId(row.userId),
    account_attribution_state: row.accountAttributionState ?? "confirmed",
    superseded_at: row.supersededAt ?? null,
    description: row.description ?? null,
    date: row.date,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt ?? null,
  };
}

function shouldUpdateLocal(serverUpdatedAt: string, localUpdatedAt: string | undefined): boolean {
  return !localUpdatedAt || serverUpdatedAt > localUpdatedAt;
}

function fromSupabaseRow(row: SupabaseTransactionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    categoryId: row.category_id,
    accountId: row.account_id ?? buildDefaultFinancialAccountId(row.user_id),
    accountAttributionState: row.account_attribution_state ?? "confirmed",
    supersededAt: row.superseded_at ?? null,
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function fromSupabaseFinancialAccountRow(
  row: SupabaseFinancialAccountRow
): Parameters<typeof upsertFinancialAccount>[1] {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } as Parameters<typeof upsertFinancialAccount>[1];
}

function fromSupabaseTransferRow(row: SupabaseTransferRow): Parameters<typeof upsertTransfer>[1] {
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

function fromSupabaseOpeningBalanceRow(
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

function fromSupabaseFinancialAccountIdentifierRow(
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

type PullTableName = keyof typeof LAST_SYNC_AT_BY_TABLE;
type PullCursor = { updatedAt: string; id: string | null };

function rowToPullCursor(row: { updated_at: string; id: string }): PullCursor {
  return {
    updatedAt: row.updated_at,
    id: row.id,
  };
}

function serializePullCursor(cursor: PullCursor): string {
  return JSON.stringify(cursor);
}

function parsePullCursor(value: string): PullCursor {
  try {
    const parsed = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.updatedAt === "string" &&
      ("id" in parsed ? typeof parsed.id === "string" || parsed.id === null : true)
    ) {
      return {
        updatedAt: parsed.updatedAt,
        id: parsed.id ?? null,
      };
    }
  } catch {
    // Legacy timestamp-only cursor
  }

  return {
    updatedAt: value,
    id: null,
  };
}

function toCompositeCursorFilter(cursor: PullCursor): string {
  return `updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`;
}

async function fetchPullRows<T extends { updated_at: string; id: string }>(
  supabase: SupabaseClient,
  userId: string,
  tableName: string,
  lastSyncAt: PullCursor | null
) {
  const baseQuery = supabase.from(tableName).select("*").eq("user_id", userId);
  const query = !lastSyncAt
    ? baseQuery
    : lastSyncAt.id == null
      ? baseQuery.gte("updated_at", lastSyncAt.updatedAt)
      : baseQuery.or(toCompositeCursorFilter(lastSyncAt));
  return (await query
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(PULL_PAGE_SIZE)) as {
    data: T[] | null;
    error: { message?: string; code?: string } | null;
  };
}

async function getPullCursor(db: AnyDb, tableName: PullTableName) {
  const tableCursor = await getSyncMeta(db, LAST_SYNC_AT_BY_TABLE[tableName]);
  if (tableCursor) {
    return parsePullCursor(tableCursor);
  }

  if (tableName === "transactions") {
    const legacyCursor = await getSyncMeta(db, LEGACY_LAST_SYNC_AT);
    return legacyCursor ? parsePullCursor(legacyCursor) : null;
  }

  return null;
}

async function setPullCursor(db: AnyDb, tableName: PullTableName, value: PullCursor) {
  await setSyncMeta(db, LAST_SYNC_AT_BY_TABLE[tableName], serializePullCursor(value));

  if (tableName === "transactions") {
    await setSyncMeta(db, LEGACY_LAST_SYNC_AT, value.updatedAt);
  }
}

async function advancePullCursor(
  db: AnyDb,
  tableName: PullTableName,
  safeCursor: PullCursor | null
) {
  // Leave empty initial pulls uninitialized so later rows cannot be skipped by a synthetic cursor.
  if (safeCursor) {
    await setPullCursor(db, tableName, safeCursor);
  }
}

function applyServerRows<
  TRow extends { id: string; updated_at: string },
  TMappedRow,
  TLocalRow extends { updatedAt: string } | null,
>(
  db: AnyDb,
  rows: readonly TRow[],
  options: {
    getLocalRow: (db: AnyDb, rowId: string) => TLocalRow;
    upsertLocalRow: (db: AnyDb, row: TMappedRow) => void;
    mapServerRow: (row: TRow) => TMappedRow;
  }
) {
  let failedCount = 0;
  let safeCursor: PullCursor | null = null;
  let sawFailure = false;

  for (const serverRow of rows) {
    try {
      const localRow = options.getLocalRow(db, serverRow.id);
      if (shouldUpdateLocal(serverRow.updated_at, localRow?.updatedAt)) {
        options.upsertLocalRow(db, options.mapServerRow(serverRow));
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

async function processBudgetEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  rowId: string
): Promise<boolean> {
  const row = getBudgetById(db, requireBudgetId(rowId));
  if (!row) return true;
  const { error } = await supabase.from("budgets").upsert({
    id: row.id,
    user_id: row.userId,
    category_id: row.categoryId,
    amount: row.amount,
    month: row.month,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  });
  return !error;
}

async function processGoalEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  rowId: string
): Promise<boolean> {
  const row = getGoalById(db, rowId);
  if (!row) return true; // row deleted locally, mark as processed
  const { error } = await supabase.from("goals").upsert({
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
  return !error;
}

async function processFinancialAccountEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  rowId: string
): Promise<boolean> {
  const row = getFinancialAccountById(db, rowId as Parameters<typeof getFinancialAccountById>[1]);
  if (!row) return true;
  const { error } = await supabase.from("financial_accounts").upsert({
    id: row.id,
    user_id: row.userId,
    name: row.name,
    kind: row.kind,
    is_default: row.isDefault,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  });
  return !error;
}

async function processTransferEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  rowId: string
): Promise<boolean> {
  const row = getTransferById(db, rowId as Parameters<typeof getTransferById>[1]);
  if (!row) return true;
  const { error } = await supabase.from("transfers").upsert({
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
  return !error;
}

async function processOpeningBalanceEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  rowId: string
): Promise<boolean> {
  const row = getOpeningBalanceById(db, rowId as Parameters<typeof getOpeningBalanceById>[1]);
  if (!row) return true;
  const { error } = await supabase.from("opening_balances").upsert(
    {
      id: row.id,
      user_id: row.userId,
      account_id: row.accountId,
      amount: row.amount,
      effective_date: row.effectiveDate,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt,
    },
    { onConflict: "account_id" }
  );
  return !error;
}

async function processFinancialAccountIdentifierEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  rowId: string
): Promise<boolean> {
  const row = getFinancialAccountIdentifierById(
    db,
    rowId as Parameters<typeof getFinancialAccountIdentifierById>[1]
  );
  if (!row) return true;
  const { error } = await supabase.from("financial_account_identifiers").upsert(
    {
      id: row.id,
      user_id: row.userId,
      account_id: row.accountId,
      scope: row.scope,
      value: row.value,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt,
    },
    { onConflict: "user_id,account_id,scope,value" }
  );
  return !error;
}

async function processContributionEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  rowId: string
): Promise<boolean> {
  const row = getContributionById(db, rowId);
  if (!row) return true;
  const { error } = await supabase.from("goal_contributions").upsert({
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
  return !error;
}

async function processEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  entry: { id: SyncQueueId; tableName: string; rowId: string }
): Promise<SyncQueueId | null> {
  if (entry.tableName === "transactions") {
    const row = await getTransactionById(db, requireTransactionId(entry.rowId));
    if (!row) return entry.id;
    const { error } = await supabase.from("transactions").upsert(toSupabaseRow(row));
    if (error) {
      captureWarning("sync_push_entry_failed", {
        tableName: entry.tableName,
        errorMessage: error.message,
        errorCode: error.code ?? "unknown",
      });
    }
    return error ? null : entry.id;
  }

  if (entry.tableName === "budgets") {
    const ok = await processBudgetEntry(db, supabase, entry.rowId);
    if (!ok) captureWarning("sync_push_entry_failed", { tableName: "budgets" });
    return ok ? entry.id : null;
  }

  if (entry.tableName === "financialAccounts") {
    const ok = await processFinancialAccountEntry(db, supabase, entry.rowId);
    if (!ok) captureWarning("sync_push_entry_failed", { tableName: "financialAccounts" });
    return ok ? entry.id : null;
  }

  if (entry.tableName === "transfers") {
    const ok = await processTransferEntry(db, supabase, entry.rowId);
    if (!ok) captureWarning("sync_push_entry_failed", { tableName: "transfers" });
    return ok ? entry.id : null;
  }

  if (entry.tableName === "openingBalances") {
    const ok = await processOpeningBalanceEntry(db, supabase, entry.rowId);
    if (!ok) captureWarning("sync_push_entry_failed", { tableName: "openingBalances" });
    return ok ? entry.id : null;
  }

  if (entry.tableName === "financialAccountIdentifiers") {
    const ok = await processFinancialAccountIdentifierEntry(db, supabase, entry.rowId);
    if (!ok) {
      captureWarning("sync_push_entry_failed", { tableName: "financialAccountIdentifiers" });
    }
    return ok ? entry.id : null;
  }

  if (entry.tableName === "goals") {
    const ok = await processGoalEntry(db, supabase, entry.rowId);
    if (!ok) captureWarning("sync_push_entry_failed", { tableName: "goals" });
    return ok ? entry.id : null;
  }

  if (entry.tableName === "goalContributions") {
    const ok = await processContributionEntry(db, supabase, entry.rowId);
    if (!ok) captureWarning("sync_push_entry_failed", { tableName: "goalContributions" });
    return ok ? entry.id : null;
  }

  // Unknown table — keep in queue for future handler
  captureWarning("sync_push_unknown_table", { tableName: entry.tableName });
  return null;
}

export async function syncPush(
  db: AnyDb,
  supabase: SupabaseClient,
  _userId: string
): Promise<void> {
  const entries = await getQueuedSyncEntries(db);
  if (entries.length === 0) return;

  const results = await Promise.allSettled(entries.map((e) => processEntry(db, supabase, e)));
  const processedIds = results
    .filter(
      (r): r is PromiseFulfilledResult<SyncQueueId> => r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);

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

export async function syncPull(
  db: AnyDb,
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const [
    financialAccountsCursor,
    transfersCursor,
    openingBalancesCursor,
    financialAccountIdentifiersCursor,
    transactionsCursor,
  ] = await Promise.all([
    getPullCursor(db, "financial_accounts"),
    getPullCursor(db, "transfers"),
    getPullCursor(db, "opening_balances"),
    getPullCursor(db, "financial_account_identifiers"),
    getPullCursor(db, "transactions"),
  ]);
  const pullResults = await Promise.all([
    fetchPullRows<SupabaseFinancialAccountRow>(
      supabase,
      userId,
      "financial_accounts",
      financialAccountsCursor
    ),
    fetchPullRows<SupabaseTransferRow>(supabase, userId, "transfers", transfersCursor),
    fetchPullRows<SupabaseOpeningBalanceRow>(
      supabase,
      userId,
      "opening_balances",
      openingBalancesCursor
    ),
    fetchPullRows<SupabaseFinancialAccountIdentifierRow>(
      supabase,
      userId,
      "financial_account_identifiers",
      financialAccountIdentifiersCursor
    ),
    fetchPullRows<SupabaseTransactionRow>(supabase, userId, "transactions", transactionsCursor),
  ]);

  const [
    financialAccountsResult,
    transfersResult,
    openingBalancesResult,
    financialAccountIdentifiersResult,
    transactionsResult,
  ] = pullResults;

  const failedFetch = [
    { tableName: "financial_accounts", result: financialAccountsResult },
    { tableName: "transfers", result: transfersResult },
    { tableName: "opening_balances", result: openingBalancesResult },
    { tableName: "financial_account_identifiers", result: financialAccountIdentifiersResult },
    { tableName: "transactions", result: transactionsResult },
  ].find(({ result }) => result.error || !result.data);

  if (failedFetch) {
    captureWarning("sync_pull_fetch_failed", {
      tableName: failedFetch.tableName,
      errorMessage: failedFetch.result.error?.message ?? "no_data",
      errorCode: failedFetch.result.error?.code ?? "unknown",
    });
    return false;
  }

  const financialAccountRows = financialAccountsResult.data ?? [];
  const transferRows = transfersResult.data ?? [];
  const openingBalanceRows = openingBalancesResult.data ?? [];
  const financialAccountIdentifierRows = financialAccountIdentifiersResult.data ?? [];
  const transactionRows = transactionsResult.data ?? [];
  const allUpdatedAts = [
    ...financialAccountRows.map((row) => row.updated_at),
    ...transferRows.map((row) => row.updated_at),
    ...openingBalanceRows.map((row) => row.updated_at),
    ...financialAccountIdentifierRows.map((row) => row.updated_at),
    ...transactionRows.map((row) => row.updated_at),
  ];
  // FP exemption: each row may depend on prior upserts for conflict detection.
  let failedCount = 0;
  let conflictCount = 0;
  const financialAccountsOutcome = applyServerRows(db, financialAccountRows, {
    getLocalRow: (database, rowId) =>
      getFinancialAccountById(database, rowId as Parameters<typeof getFinancialAccountById>[1]),
    upsertLocalRow: upsertFinancialAccount,
    mapServerRow: fromSupabaseFinancialAccountRow,
  });
  failedCount += financialAccountsOutcome.failedCount;

  const transfersOutcome = applyServerRows(db, transferRows, {
    getLocalRow: (database, rowId) =>
      getTransferById(database, rowId as Parameters<typeof getTransferById>[1]),
    upsertLocalRow: upsertTransfer,
    mapServerRow: fromSupabaseTransferRow,
  });
  failedCount += transfersOutcome.failedCount;

  const openingBalancesOutcome = applyServerRows(db, openingBalanceRows, {
    getLocalRow: (database, rowId) =>
      getOpeningBalanceById(database, rowId as Parameters<typeof getOpeningBalanceById>[1]),
    upsertLocalRow: upsertOpeningBalance,
    mapServerRow: fromSupabaseOpeningBalanceRow,
  });
  failedCount += openingBalancesOutcome.failedCount;

  const financialAccountIdentifiersOutcome = applyServerRows(db, financialAccountIdentifierRows, {
    getLocalRow: (database, rowId) =>
      getFinancialAccountIdentifierById(
        database,
        rowId as Parameters<typeof getFinancialAccountIdentifierById>[1]
      ),
    upsertLocalRow: upsertFinancialAccountIdentifier,
    mapServerRow: fromSupabaseFinancialAccountIdentifierRow,
  });
  failedCount += financialAccountIdentifiersOutcome.failedCount;
  let transactionsFailedCount = 0;
  let transactionsSafeCursor: PullCursor | null = null;
  let transactionsSawFailure = false;

  for (const serverRow of transactionRows) {
    try {
      const transactionId = requireTransactionId(serverRow.id);
      const localRow = await getTransactionById(db, transactionId);
      const mappedServerRow = fromSupabaseRow(serverRow);

      if (shouldUpdateLocal(serverRow.updated_at, localRow?.updatedAt)) {
        const comparableLocalRow =
          localRow == null
            ? null
            : {
                ...localRow,
                description: localRow.description ?? null,
                deletedAt: localRow.deletedAt ?? null,
              };
        const comparableServerRow = {
          ...mappedServerRow,
          description: mappedServerRow.description ?? null,
          deletedAt: mappedServerRow.deletedAt ?? null,
        };
        const isConflict =
          comparableLocalRow != null && hasDataConflict(comparableLocalRow, comparableServerRow);
        await upsertTransaction(db, mappedServerRow as Parameters<typeof upsertTransaction>[1]);
        // Log conflict after successful upsert to avoid duplicates on retry.
        // Own try/catch so a conflict-logging failure doesn't affect the sync flow.
        if (isConflict) {
          conflictCount++;
          try {
            insertConflict(db, {
              id: generateSyncConflictId(),
              transactionId,
              localData: JSON.stringify(localRow),
              serverData: JSON.stringify(mappedServerRow),
              detectedAt: toIsoDateTime(new Date()),
            });
          } catch (conflictErr) {
            captureError(conflictErr);
          }
        }
      }
      if (!transactionsSawFailure) {
        transactionsSafeCursor = rowToPullCursor(serverRow);
      }
    } catch (error) {
      captureError(error);
      transactionsFailedCount++;
      transactionsSawFailure = true;
    }
  }
  failedCount += transactionsFailedCount;

  capturePipelineEvent({
    source: "sync_pull",
    rowsFetched: allUpdatedAts.length,
    rowsApplied: allUpdatedAts.length - failedCount,
    conflicts: conflictCount,
    failed: failedCount,
  });

  await Promise.all([
    advancePullCursor(db, "financial_accounts", financialAccountsOutcome.safeCursor),
    advancePullCursor(db, "transfers", transfersOutcome.safeCursor),
    advancePullCursor(db, "opening_balances", openingBalancesOutcome.safeCursor),
    advancePullCursor(
      db,
      "financial_account_identifiers",
      financialAccountIdentifiersOutcome.safeCursor
    ),
    advancePullCursor(db, "transactions", transactionsSafeCursor),
  ]);

  return true;
}

export async function fullSync(
  db: AnyDb,
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const pullOk = await syncPull(db, supabase, userId);
  if (pullOk) {
    await syncPush(db, supabase, userId);
  }
  return pullOk;
}
