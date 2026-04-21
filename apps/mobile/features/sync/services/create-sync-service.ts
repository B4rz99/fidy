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

const unresolvedConflictResultEffect = (db: SyncContext["db"]) =>
  Effect.map(unresolvedConflictCountEffect(db), (unresolvedConflicts) => ({
    unresolvedConflicts,
  }));

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

function getConflictRow(
  rows: readonly ConflictRow[],
  conflictId: ResolveTransactionConflictInput["conflictId"]
) {
  return rows.find((conflict) => conflict.id === conflictId) ?? null;
}

function getLocalResolutionData(
  row: ConflictRow,
  resolution: ResolveTransactionConflictInput["resolution"]
) {
  return resolution === "local" ? (JSON.parse(row.localData) as TransactionSnapshot) : null;
}

const getRefreshUserId = (
  localData: TransactionSnapshot | null,
  serverData: TransactionSnapshot | null
) => localData?.userId ?? serverData?.userId ?? null;

function persistLocalResolutionEffect(input: {
  readonly db: SyncContext["db"];
  readonly row: ConflictRow;
  readonly localData: TransactionSnapshot | null;
  readonly resolvedAt: IsoDateTime;
  readonly upsertTransaction: UpsertTransaction;
  readonly enqueueTransactionSync: EnqueueTransactionSync;
}) {
  if (input.localData == null) {
    return Effect.succeed(undefined);
  }

  const localData = input.localData;
  return Effect.all([
    fromThunk(() =>
      input.upsertTransaction(input.db, {
        ...localData,
        updatedAt: input.resolvedAt,
      })
    ),
    fromThunk(() =>
      input.enqueueTransactionSync(input.db, input.row.transactionId, input.resolvedAt)
    ),
  ]);
}

function refreshResolvedConflictEffect(input: {
  readonly db: SyncContext["db"];
  readonly userId: string | null;
  readonly refreshTransactions: RefreshTransactions;
}) {
  if (input.userId == null) {
    return Effect.succeed(undefined);
  }

  const userId = input.userId;
  return fromThunk(() => input.refreshTransactions({ db: input.db, userId }));
}

function resolveConflictEffect({ db, conflictId, resolution }: ResolveTransactionConflictInput) {
  return Effect.gen(function* () {
    const rows = yield* getConflictRowsEffect(db);
    const row = getConflictRow(rows, conflictId);
    if (!row) {
      return yield* unresolvedConflictResultEffect(db);
    }

    const { upsertTransaction, enqueueTransactionSync, resolveConflictRow, refreshTransactions } =
      yield* SyncDeps.tag;
    const resolvedAt = yield* currentIsoDateTimeEffect;
    const serverData = tryParseTransactionSnapshot(row.serverData);
    const localData = getLocalResolutionData(row, resolution);
    const refreshUserId = getRefreshUserId(localData, serverData);

    yield* persistLocalResolutionEffect({
      db,
      row,
      localData,
      resolvedAt,
      upsertTransaction,
      enqueueTransactionSync,
    });

    yield* fromThunk(() => resolveConflictRow(db, conflictId, resolution, resolvedAt));
    yield* refreshResolvedConflictEffect({
      db,
      userId: refreshUserId,
      refreshTransactions,
    });

    return yield* unresolvedConflictResultEffect(db);
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
