import type { SupabaseClient } from "@supabase/supabase-js";
import { Effect } from "effect";
import { type AppClock, bindAppClock, currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { type AppNetwork, bindAppNetwork, isOnlineEffect } from "@/shared/effect/network";
import { fromPromise, fromSync, fromThunk, makeAppService } from "@/shared/effect/runtime";
import {
  type AppSupabase,
  bindAppSupabase,
  currentSupabaseClientEffect,
} from "@/shared/effect/supabase";
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
  readonly syncPull: SyncPull;
  readonly syncPush: SyncPush;
  readonly refreshTransactions: RefreshTransactions;
  readonly getConflictRows: (input: SyncContext) => Promise<readonly ConflictRow[]>;
  readonly upsertTransaction: UpsertTransaction;
  readonly enqueueTransactionSync: EnqueueTransactionSync;
  readonly resolveConflictRow: ResolveConflictRow;
  readonly clock?: AppClock;
  readonly network?: AppNetwork;
  readonly supabase?: AppSupabase;
};

export type SyncService = {
  readonly run: (input: SyncInput) => Promise<SyncRunResult>;
  readonly listConflicts: (input: SyncContext) => Promise<readonly SyncConflict[]>;
  readonly resolveConflict: (
    input: ResolveTransactionConflictInput
  ) => Promise<ResolveConflictResult>;
};

const SyncDeps = makeAppService<CreateSyncServiceDeps>("@/features/sync/SyncDeps");

function tryParseTransactionSnapshot(value: string): TransactionSnapshot | null {
  try {
    return JSON.parse(value) as TransactionSnapshot;
  } catch {
    return null;
  }
}

const getConflictRowsEffect = (db: SyncContext["db"]) =>
  Effect.flatMap(SyncDeps.tag, ({ getConflictRows }) => fromPromise(() => getConflictRows({ db })));

const unresolvedConflictCountEffect = (db: SyncContext["db"]) =>
  Effect.map(listConflictsEffect({ db }), (conflicts) => conflicts.length);

function listConflictsEffect({ db }: SyncContext) {
  return Effect.flatMap(getConflictRowsEffect(db), (rows) =>
    Effect.forEach(rows, (row) =>
      fromSync(() => ({
        id: row.id,
        transactionId: row.transactionId,
        localData: JSON.parse(row.localData) as TransactionSnapshot,
        serverData: JSON.parse(row.serverData) as TransactionSnapshot,
        detectedAt: row.detectedAt,
      }))
    )
  );
}

function resolveConflictEffect({ db, conflictId, resolution }: ResolveTransactionConflictInput) {
  return Effect.gen(function* () {
    const rows = yield* getConflictRowsEffect(db);
    const row = rows.find((conflict) => conflict.id === conflictId);
    if (!row) {
      return {
        unresolvedConflicts: yield* unresolvedConflictCountEffect(db),
      };
    }

    const { upsertTransaction, enqueueTransactionSync, resolveConflictRow, refreshTransactions } =
      yield* SyncDeps.tag;
    const resolvedAt = yield* currentIsoDateTimeEffect;
    const serverData = tryParseTransactionSnapshot(row.serverData);
    const localData =
      resolution === "local" ? (JSON.parse(row.localData) as TransactionSnapshot) : null;
    const refreshUserId = localData?.userId ?? serverData?.userId ?? null;

    if (resolution === "local" && localData) {
      yield* fromThunk(() => upsertTransaction(db, { ...localData, updatedAt: resolvedAt }));
      yield* fromThunk(() => enqueueTransactionSync(db, row.transactionId, resolvedAt));
    }

    yield* fromThunk(() => resolveConflictRow(db, conflictId, resolution, resolvedAt));
    if (refreshUserId != null) {
      yield* fromThunk(() => refreshTransactions({ db, userId: refreshUserId }));
    }

    return {
      unresolvedConflicts: yield* unresolvedConflictCountEffect(db),
    };
  });
}

function runSyncEffect({ db, userId, reason: _reason = "foreground" }: SyncInput) {
  return Effect.gen(function* () {
    void _reason;

    const { syncPull, syncPush, refreshTransactions } = yield* SyncDeps.tag;
    const online = yield* isOnlineEffect;
    if (!online) {
      return {
        status: "skipped_offline" as const,
        unresolvedConflicts: yield* unresolvedConflictCountEffect(db),
      };
    }

    const supabase = yield* currentSupabaseClientEffect;
    const pullOk = yield* fromPromise(() => syncPull(db, supabase, userId));
    if (pullOk) {
      yield* fromPromise(() => syncPush(db, supabase, userId));
      yield* fromThunk(() => refreshTransactions({ db, userId }));
    }

    return {
      status: pullOk ? ("synced" as const) : ("failed_pull" as const),
      unresolvedConflicts: yield* unresolvedConflictCountEffect(db),
    };
  });
}

export function createSyncService({
  syncPull,
  syncPush,
  refreshTransactions,
  getConflictRows,
  upsertTransaction,
  enqueueTransactionSync,
  resolveConflictRow,
  clock,
  network,
  supabase,
}: CreateSyncServiceDeps): SyncService {
  const clockRuntime = bindAppClock(clock);
  const networkRuntime = bindAppNetwork(network);
  const supabaseRuntime = bindAppSupabase(supabase);
  const runtime = SyncDeps.bind({
    syncPull,
    syncPush,
    refreshTransactions,
    getConflictRows,
    upsertTransaction,
    enqueueTransactionSync,
    resolveConflictRow,
  } satisfies CreateSyncServiceDeps);

  return {
    listConflicts: (input) => runtime.run(clockRuntime.provide(listConflictsEffect(input))),
    resolveConflict: (input) => runtime.run(clockRuntime.provide(resolveConflictEffect(input))),
    run: (input) =>
      runtime.run(
        supabaseRuntime.provide(networkRuntime.provide(clockRuntime.provide(runSyncEffect(input))))
      ),
  };
}
