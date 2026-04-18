// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names
import { refreshTransactions, upsertTransaction } from "@/features/transactions";
import { enqueueSync, getSupabase } from "@/shared/db";
import { generateSyncQueueId } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import {
  getUnresolvedConflicts,
  resolveConflict as resolveConflictDb,
} from "../lib/conflict-repository";
import { createSyncService } from "./create-sync-service";
import { isOnline } from "./networkMonitor";
import { syncPull, syncPush } from "./syncEngine";
import type {
  ResolveConflictResult,
  ResolveTransactionConflictInput,
  SyncConflict,
  SyncContext,
  SyncInput,
  SyncRunResult,
} from "./types";

const syncService = createSyncService({
  isOnline,
  getSupabase,
  syncPull,
  syncPush,
  refreshTransactions: async ({ db, userId }) => {
    await refreshTransactions(db, userId as UserId);
  },
  getConflictRows: async ({ db }) => getUnresolvedConflicts(db),
  upsertTransaction: async (db, row) => {
    upsertTransaction(db, row as Parameters<typeof upsertTransaction>[1]);
  },
  enqueueTransactionSync: async (db, transactionId, createdAt) => {
    enqueueSync(db, {
      id: generateSyncQueueId(),
      tableName: "transactions",
      rowId: transactionId,
      operation: "update",
      createdAt,
    });
  },
  resolveConflictRow: async (db, conflictId, resolution, resolvedAt) => {
    resolveConflictDb(db, conflictId, resolution, resolvedAt);
  },
});

export async function sync(input: SyncInput): Promise<SyncRunResult> {
  return syncService.run(input);
}

export async function listConflicts(input: SyncContext): Promise<readonly SyncConflict[]> {
  return syncService.listConflicts(input);
}

export async function resolveConflict({
  ...input
}: ResolveTransactionConflictInput): Promise<ResolveConflictResult> {
  return syncService.resolveConflict(input);
}

export type {
  ConflictResolution,
  ResolveConflictResult,
  ResolveTransactionConflictInput,
  SyncConflict,
  SyncContext,
  SyncInput,
  SyncRunResult,
  TransactionSnapshot,
} from "./types";
