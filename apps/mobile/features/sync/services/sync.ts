// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names
import { upsertTransaction, useTransactionStore } from "@/features/transactions";
import { type AnyDb, enqueueSync, getSupabase } from "@/shared/db";
import { generateSyncQueueId, toIsoDateTime } from "@/shared/lib";
import type { SyncConflictId } from "@/shared/types/branded";
import {
  getUnresolvedConflicts,
  resolveConflict as resolveConflictDb,
} from "../lib/conflict-repository";
import { isOnline } from "./networkMonitor";
import { syncPull, syncPush } from "./syncEngine";

export type TransactionSnapshot = {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly amount: number;
  readonly categoryId: string;
  readonly description: string | null;
  readonly date: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly source: string;
};

export type SyncConflict = {
  readonly id: string;
  readonly transactionId: string;
  readonly localData: TransactionSnapshot;
  readonly serverData: TransactionSnapshot;
  readonly detectedAt: string;
};

export type SyncContext = {
  readonly db: AnyDb;
};

export type SyncReason = "startup" | "foreground" | "reconnected" | "manual";

export type SyncInput = SyncContext & {
  readonly userId: string;
  readonly reason?: SyncReason;
};

export type SyncRunResult =
  | {
      readonly status: "synced";
      readonly unresolvedConflicts: number;
    }
  | {
      readonly status: "skipped_offline";
      readonly unresolvedConflicts: number;
    }
  | {
      readonly status: "failed_pull";
      readonly unresolvedConflicts: number;
    };

export type ConflictResolution = "local" | "server";

export type ResolveTransactionConflictInput = SyncContext & {
  readonly conflictId: SyncConflictId;
  readonly resolution: ConflictResolution;
};

export type ResolveConflictResult = {
  readonly unresolvedConflicts: number;
};

function parseConflict(row: {
  readonly id: string;
  readonly transactionId: string;
  readonly localData: string;
  readonly serverData: string;
  readonly detectedAt: string;
}): SyncConflict {
  return {
    id: row.id,
    transactionId: row.transactionId,
    localData: JSON.parse(row.localData) as TransactionSnapshot,
    serverData: JSON.parse(row.serverData) as TransactionSnapshot,
    detectedAt: row.detectedAt,
  };
}

export async function listConflicts({ db }: SyncContext): Promise<readonly SyncConflict[]> {
  return getUnresolvedConflicts(db).map(parseConflict);
}

export async function sync({
  db,
  userId,
  reason: _reason = "foreground",
}: SyncInput): Promise<SyncRunResult> {
  void _reason;
  const online = await isOnline();
  if (!online) {
    return {
      status: "skipped_offline",
      unresolvedConflicts: (await listConflicts({ db })).length,
    };
  }

  const supabase = getSupabase();
  const pullOk = await syncPull(db, supabase, userId);
  if (pullOk) {
    await syncPush(db, supabase, userId);
    await useTransactionStore.getState().refresh();
  }

  return {
    status: pullOk ? "synced" : "failed_pull",
    unresolvedConflicts: (await listConflicts({ db })).length,
  };
}

export async function resolveConflict({
  db,
  conflictId,
  resolution,
}: ResolveTransactionConflictInput): Promise<ResolveConflictResult> {
  const row = getUnresolvedConflicts(db).find((conflict) => conflict.id === conflictId);
  if (!row) {
    return {
      unresolvedConflicts: (await listConflicts({ db })).length,
    };
  }

  const resolvedAt = toIsoDateTime(new Date());

  if (resolution === "local") {
    const localData = JSON.parse(row.localData) as TransactionSnapshot;
    upsertTransaction(db, { ...localData, updatedAt: resolvedAt } as Parameters<
      typeof upsertTransaction
    >[1]);
    enqueueSync(db, {
      id: generateSyncQueueId(),
      tableName: "transactions",
      rowId: row.transactionId,
      operation: "update",
      createdAt: resolvedAt,
    });
  }

  resolveConflictDb(db, conflictId, resolution, resolvedAt);
  await useTransactionStore.getState().refresh();

  return {
    unresolvedConflicts: (await listConflicts({ db })).length,
  };
}
