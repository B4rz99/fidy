// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBudgetById } from "@/features/budget";
import { getContributionById, getGoalById } from "@/features/goals";
import {
  clearSyncEntries,
  getQueuedSyncEntries,
  getSyncMeta,
  getTransactionById,
  setSyncMeta,
  upsertTransaction,
} from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import {
  captureError,
  capturePipelineEvent,
  captureWarning,
  generateSyncConflictId,
  toIsoDateTime,
} from "@/shared/lib";
import {
  requireBudgetId,
  requireTransactionId,
} from "@/shared/types/assertions";
import type { SyncQueueId } from "@/shared/types/branded";
import { hasDataConflict } from "../lib/conflict-detection";
import { insertConflict } from "../lib/conflict-repository";

const LAST_SYNC_AT = "last_sync_at";

type SupabaseTransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  category_id: string;
  description: string | null;
  date: string;
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
  description: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}): SupabaseTransactionRow {
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type,
    amount: row.amount,
    category_id: row.categoryId,
    description: row.description,
    date: row.date,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
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
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
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
  const lastSyncAt = await getSyncMeta(db, LAST_SYNC_AT);

  const baseQuery = supabase.from("transactions").select("*").eq("user_id", userId);
  const query = lastSyncAt ? baseQuery.gte("updated_at", lastSyncAt) : baseQuery;

  const { data, error } = await query.order("updated_at", { ascending: true }).limit(1000);
  if (error || !data) {
    captureWarning("sync_pull_fetch_failed", {
      errorMessage: error?.message ?? "no_data",
      errorCode: error?.code ?? "unknown",
    });
    return false;
  }

  const rows = data as SupabaseTransactionRow[];

  // FP exemption: each row may depend on prior upserts for conflict detection.
  let earliestFailure: string | null = null;
  let failedCount = 0;
  let conflictCount = 0;
  for (const serverRow of rows) {
    try {
      const transactionId = requireTransactionId(serverRow.id);
      const localRow = await getTransactionById(db, transactionId);
      const mappedServerRow = fromSupabaseRow(serverRow);

      if (shouldUpdateLocal(serverRow.updated_at, localRow?.updatedAt)) {
        const isConflict =
          localRow != null && hasDataConflict(localRow, mappedServerRow as typeof localRow);
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
    } catch (error) {
      captureError(error);
      failedCount++;
      if (!earliestFailure || serverRow.updated_at < earliestFailure) {
        earliestFailure = serverRow.updated_at;
      }
    }
  }

  capturePipelineEvent({
    source: "sync_pull",
    rowsFetched: rows.length,
    rowsApplied: rows.length - failedCount,
    conflicts: conflictCount,
    failed: failedCount,
  });

  // Only advance cursor up to (but not past) the earliest failed row
  // so it gets retried on the next pull. If the earliest row failed,
  // don't advance at all — the entire batch will be retried.
  if (earliestFailure) {
    const safeTimestamps = rows.map((r) => r.updated_at).filter((ts) => ts < earliestFailure);
    if (safeTimestamps.length > 0) {
      const safeCursor = safeTimestamps.reduce((max, ts) => (ts > max ? ts : max));
      await setSyncMeta(db, LAST_SYNC_AT, safeCursor);
    }
    // else: earliest row failed — don't advance cursor
  } else if (rows.length > 0) {
    const firstRow = rows[0];
    if (!firstRow) return false;
    const maxUpdatedAt = rows.reduce(
      (max, r) => (r.updated_at > max ? r.updated_at : max),
      firstRow.updated_at
    );
    await setSyncMeta(db, LAST_SYNC_AT, maxUpdatedAt);
  } else if (!lastSyncAt) {
    await setSyncMeta(db, LAST_SYNC_AT, new Date().toISOString());
  }

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
