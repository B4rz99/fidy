import { create } from "zustand";
import { enqueueSync, upsertTransaction } from "@/features/transactions/lib/repository";
import { useTransactionStore } from "@/features/transactions/store";
import type { AnyDb } from "@/shared/db/client";
import { generateId } from "@/shared/lib/generate-id";
import { captureError } from "@/shared/lib/sentry";
import {
  getUnresolvedConflicts,
  resolveConflict as resolveConflictDb,
} from "./lib/conflict-repository";

let dbRef: AnyDb | null = null;

type TransactionSnapshot = {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly amountCents: number;
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

type SyncConflictState = {
  conflicts: SyncConflict[];
  conflictCount: number;
};

type SyncConflictActions = {
  initStore: (db: AnyDb) => void;
  loadConflicts: () => void;
  resolveConflict: (id: string, resolution: "local" | "server") => Promise<void>;
};

export const useSyncConflictStore = create<SyncConflictState & SyncConflictActions>((set, get) => ({
  conflicts: [],
  conflictCount: 0,

  initStore: (db) => {
    dbRef = db;
  },

  loadConflicts: () => {
    if (!dbRef) return;
    try {
      const rows = getUnresolvedConflicts(dbRef);
      const conflicts = rows.map((row) => ({
        id: row.id,
        transactionId: row.transactionId,
        localData: JSON.parse(row.localData) as TransactionSnapshot,
        serverData: JSON.parse(row.serverData) as TransactionSnapshot,
        detectedAt: row.detectedAt,
      }));
      set({ conflicts, conflictCount: conflicts.length });
    } catch (err) {
      captureError(err);
    }
  },

  resolveConflict: async (id, resolution) => {
    if (!dbRef) return;
    const conflict = get().conflicts.find((c) => c.id === id);
    if (!conflict) return;

    const now = new Date().toISOString();

    if (resolution === "local") {
      upsertTransaction(dbRef, conflict.localData);
      enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "transactions",
        rowId: conflict.transactionId,
        operation: "update",
        createdAt: now,
      });
    }

    resolveConflictDb(dbRef, id, resolution, now);
    get().loadConflicts();
    await useTransactionStore.getState().refresh();
  },
}));
