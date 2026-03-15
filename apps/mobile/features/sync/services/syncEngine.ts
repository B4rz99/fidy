// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clearSyncEntries,
  getQueuedSyncEntries,
  getSyncMeta,
  getTransactionById,
  setSyncMeta,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db/client";
import { captureError } from "@/shared/lib/sentry";

const LAST_SYNC_AT = "last_sync_at";

type SupabaseTransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount_cents: number;
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
  amountCents: number;
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
    amount_cents: row.amountCents,
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
    amountCents: row.amount_cents,
    categoryId: row.category_id,
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

async function processEntry(
  db: AnyDb,
  supabase: SupabaseClient,
  entry: { id: string; tableName: string; rowId: string }
): Promise<string | null> {
  if (entry.tableName !== "transactions") return null;

  const row = await getTransactionById(db, entry.rowId);
  if (!row) return entry.id;

  const { error } = await supabase.from("transactions").upsert(toSupabaseRow(row));
  return error ? null : entry.id;
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
      (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);

  if (processedIds.length > 0) {
    await clearSyncEntries(db, processedIds);
  }
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
  if (error || !data) return false;

  const rows = data as SupabaseTransactionRow[];

  let earliestFailure: string | null = null;
  for (const serverRow of rows) {
    try {
      const localRow = await getTransactionById(db, serverRow.id);

      if (shouldUpdateLocal(serverRow.updated_at, localRow?.updatedAt)) {
        await upsertTransaction(db, fromSupabaseRow(serverRow));
      }
    } catch (error) {
      captureError(error);
      if (!earliestFailure || serverRow.updated_at < earliestFailure) {
        earliestFailure = serverRow.updated_at;
      }
    }
  }

  // Only advance cursor up to (but not past) the earliest failed row
  // so it gets retried on the next pull
  const cursorCandidates = rows.map((r) => r.updated_at);
  const maxUpdatedAt = earliestFailure
    ? cursorCandidates
        .filter((ts) => ts < earliestFailure)
        .reduce((max, ts) => (ts > max ? ts : max), "")
    : cursorCandidates.reduce((max, ts) => (ts > max ? ts : max), "");

  if (maxUpdatedAt) {
    await setSyncMeta(db, LAST_SYNC_AT, maxUpdatedAt);
  } else if (!lastSyncAt) {
    await setSyncMeta(db, LAST_SYNC_AT, new Date().toISOString());
  }

  return true;
}

export async function fullSync(db: AnyDb, supabase: SupabaseClient, userId: string): Promise<void> {
  const pullOk = await syncPull(db, supabase, userId);
  if (pullOk) {
    await syncPush(db, supabase, userId);
  }
}
