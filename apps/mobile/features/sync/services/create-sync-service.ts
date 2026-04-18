import type { SupabaseClient } from "@supabase/supabase-js";
import { Effect } from "effect";
import { fromThunk, runAppEffect } from "@/shared/effect/runtime";
import { toIsoDateTime } from "@/shared/lib";
import type { IsoDateTime } from "@/shared/types/branded";
import type {
  ConflictResolution,
  ResolveConflictResult,
  ResolveTransactionConflictInput,
  SyncConflict,
  SyncContext,
  SyncInput,
  SyncRunResult,
  TransactionSnapshot,
} from "./types";

type SyncPull = (db: SyncInput["db"], supabase: SupabaseClient, userId: string) => Promise<boolean>;
type SyncPush = (db: SyncInput["db"], supabase: SupabaseClient, userId: string) => Promise<void>;
type ConflictRow = {
  readonly id: string;
  readonly transactionId: string;
  readonly localData: string;
  readonly serverData: string;
  readonly detectedAt: string;
};
type UpsertTransaction = (db: SyncContext["db"], row: TransactionSnapshot) => void | Promise<void>;
type EnqueueTransactionSync = (
  db: SyncContext["db"],
  transactionId: string,
  createdAt: IsoDateTime
) => void | Promise<void>;
type RefreshTransactions = (input: {
  readonly db: SyncContext["db"];
  readonly userId: string;
}) => Promise<void>;
type ResolveConflictRow = (
  db: SyncContext["db"],
  conflictId: ResolveTransactionConflictInput["conflictId"],
  resolution: ConflictResolution,
  resolvedAt: IsoDateTime
) => void | Promise<void>;

type CreateSyncServiceDeps = {
  readonly isOnline: () => Promise<boolean>;
  readonly getSupabase: () => SupabaseClient;
  readonly syncPull: SyncPull;
  readonly syncPush: SyncPush;
  readonly refreshTransactions: RefreshTransactions;
  readonly getConflictRows: (input: SyncContext) => Promise<readonly ConflictRow[]>;
  readonly upsertTransaction: UpsertTransaction;
  readonly enqueueTransactionSync: EnqueueTransactionSync;
  readonly resolveConflictRow: ResolveConflictRow;
};

export type SyncService = {
  readonly run: (input: SyncInput) => Promise<SyncRunResult>;
  readonly listConflicts: (input: SyncContext) => Promise<readonly SyncConflict[]>;
  readonly resolveConflict: (
    input: ResolveTransactionConflictInput
  ) => Promise<ResolveConflictResult>;
};

export function createSyncService({
  isOnline,
  getSupabase,
  syncPull,
  syncPush,
  refreshTransactions,
  getConflictRows,
  upsertTransaction,
  enqueueTransactionSync,
  resolveConflictRow,
}: CreateSyncServiceDeps): SyncService {
  const listConflicts = async ({ db }: SyncContext): Promise<readonly SyncConflict[]> =>
    runAppEffect(
      fromThunk(() => getConflictRows({ db })).pipe(
        Effect.map((rows) =>
          rows.map((row) => ({
            id: row.id,
            transactionId: row.transactionId,
            localData: JSON.parse(row.localData) as TransactionSnapshot,
            serverData: JSON.parse(row.serverData) as TransactionSnapshot,
            detectedAt: row.detectedAt,
          }))
        )
      )
    );

  return {
    listConflicts,
    resolveConflict: async ({ db, conflictId, resolution }) => {
      return runAppEffect(
        Effect.gen(function* () {
          const rows = yield* fromThunk(() => getConflictRows({ db }));
          const row = rows.find((conflict) => conflict.id === conflictId);
          if (!row) {
            return {
              unresolvedConflicts: (yield* fromThunk(() => listConflicts({ db }))).length,
            };
          }

          const resolvedAt = toIsoDateTime(new Date());

          const localData = JSON.parse(row.localData) as TransactionSnapshot;
          const refreshUserId = localData.userId;

          if (resolution === "local") {
            yield* fromThunk(() => upsertTransaction(db, { ...localData, updatedAt: resolvedAt }));
            yield* fromThunk(() => enqueueTransactionSync(db, row.transactionId, resolvedAt));
          }

          yield* fromThunk(() => resolveConflictRow(db, conflictId, resolution, resolvedAt));
          yield* fromThunk(() => refreshTransactions({ db, userId: refreshUserId }));

          return {
            unresolvedConflicts: (yield* fromThunk(() => listConflicts({ db }))).length,
          };
        })
      );
    },
    run: async ({ db, userId, reason: _reason = "foreground" }) => {
      return runAppEffect(
        Effect.gen(function* () {
          void _reason;
          const online = yield* fromThunk(isOnline);
          if (!online) {
            return {
              status: "skipped_offline" as const,
              unresolvedConflicts: (yield* fromThunk(() => listConflicts({ db }))).length,
            };
          }

          const supabase = yield* fromThunk(getSupabase);
          const pullOk = yield* fromThunk(() => syncPull(db, supabase, userId));
          if (pullOk) {
            yield* fromThunk(() => syncPush(db, supabase, userId));
            yield* fromThunk(() => refreshTransactions({ db, userId }));
          }

          return {
            status: pullOk ? ("synced" as const) : ("failed_pull" as const),
            unresolvedConflicts: (yield* fromThunk(() => listConflicts({ db }))).length,
          };
        })
      );
    },
  };
}
