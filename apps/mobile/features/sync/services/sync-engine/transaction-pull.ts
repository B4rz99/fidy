// biome-ignore-all lint/style/useNamingConvention: snake_case matches Supabase Postgres column names

import { hasDataConflict } from "@/features/sync/lib/conflict-detection";
import { insertConflict } from "@/features/sync/lib/conflict-repository";
import { getTransactionById, upsertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import { captureError, generateSyncConflictId, toIsoDateTime } from "@/shared/lib";
import { requireTransactionId } from "@/shared/types/assertions";
import { rowToPullCursor } from "./cursor";
import { fromSupabaseTransactionRow, shouldUpdateLocal } from "./from-supabase";
import {
  toSupabaseTransactionAccountDefaults,
  toSupabaseTransactionDeleteFields,
  toSupabaseTransactionDescription,
} from "./to-supabase";
import type {
  ComparableTransactionRow,
  MaybeLocalTransactionRow,
  SupabaseTransactionRow,
  TransactionPullOutcome,
} from "./types";

function toComparableTransactionRow(row: ComparableTransactionRow) {
  return {
    ...row,
    description: row.description ?? null,
    deletedAt: row.deletedAt ?? null,
  };
}

function toComparableLocalTransactionRow(row: NonNullable<MaybeLocalTransactionRow>) {
  return {
    ...row,
    ...toSupabaseTransactionAccountDefaults(row),
    ...toSupabaseTransactionDeleteFields(row),
    description: toSupabaseTransactionDescription(row),
  };
}

function hasTransactionPullConflict(
  localRow: MaybeLocalTransactionRow,
  mappedServerRow: ComparableTransactionRow
) {
  return (
    localRow != null &&
    hasDataConflict(
      toComparableLocalTransactionRow(localRow),
      toComparableTransactionRow(mappedServerRow)
    )
  );
}

function captureTransactionPullConflict(input: {
  db: AnyDb;
  transactionId: ReturnType<typeof requireTransactionId>;
  localRow: MaybeLocalTransactionRow;
  mappedServerRow: ComparableTransactionRow;
}) {
  const conflict = {
    id: generateSyncConflictId(),
    transactionId: input.transactionId,
    localData: JSON.stringify(input.localRow),
    serverData: JSON.stringify(input.mappedServerRow),
    detectedAt: toIsoDateTime(new Date()),
  };
  try {
    insertConflict(input.db, conflict);
  } catch (conflictError) {
    captureError(conflictError);
  }
}

async function applyTransactionPullRow(input: { db: AnyDb; serverRow: SupabaseTransactionRow }) {
  try {
    const transactionId = requireTransactionId(input.serverRow.id);
    const localRow = await getTransactionById(input.db, transactionId);
    const mappedServerRow = fromSupabaseTransactionRow(input.serverRow);
    if (!shouldUpdateLocal(input.serverRow.updated_at, localRow?.updatedAt)) {
      return { failed: false, conflict: false };
    }

    const conflict = hasTransactionPullConflict(localRow, mappedServerRow);
    await upsertTransaction(input.db, mappedServerRow as Parameters<typeof upsertTransaction>[1]);
    if (conflict) {
      captureTransactionPullConflict({
        db: input.db,
        transactionId,
        localRow,
        mappedServerRow,
      });
    }
    return { failed: false, conflict };
  } catch (error) {
    captureError(error);
    return { failed: true, conflict: false };
  }
}

type TransactionPullProgress = TransactionPullOutcome & { sawFailure: boolean };

function nextTransactionPullProgress(
  progress: TransactionPullProgress,
  outcome: { failed: boolean; conflict: boolean },
  serverRow: SupabaseTransactionRow
): TransactionPullProgress {
  const sawFailure = progress.sawFailure || outcome.failed;
  return {
    failedCount: progress.failedCount + Number(outcome.failed),
    conflictCount: progress.conflictCount + Number(outcome.conflict),
    safeCursor: sawFailure ? progress.safeCursor : rowToPullCursor(serverRow),
    sawFailure,
  };
}

export async function applyTransactionPullRows(
  db: AnyDb,
  rows: SupabaseTransactionRow[]
): Promise<TransactionPullOutcome> {
  let progress: TransactionPullProgress = {
    failedCount: 0,
    conflictCount: 0,
    safeCursor: null,
    sawFailure: false,
  };

  for (const serverRow of rows) {
    const outcome = await applyTransactionPullRow({ db, serverRow });
    progress = nextTransactionPullProgress(progress, outcome, serverRow);
  }

  return {
    failedCount: progress.failedCount,
    conflictCount: progress.conflictCount,
    safeCursor: progress.safeCursor,
  };
}
