import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import type { SyncConflictId } from "@/shared/types/branded";
import {
  listConflicts,
  resolveConflict as resolveConflictBoundary,
  type SyncConflict,
} from "./services/sync";

let dbRef: AnyDb | null = null;

type SyncConflictState = {
  conflicts: SyncConflict[];
  conflictCount: number;
};

type SyncConflictActions = {
  initStore: (db: AnyDb) => void;
  loadConflicts: () => Promise<void>;
  resolveConflict: (id: string, resolution: "local" | "server") => Promise<void>;
};

export const useSyncConflictStore = create<SyncConflictState & SyncConflictActions>((set, get) => ({
  conflicts: [],
  conflictCount: 0,

  initStore: (db) => {
    dbRef = db;
  },

  loadConflicts: async () => {
    if (!dbRef) return;
    try {
      const conflicts = [...(await listConflicts({ db: dbRef }))];
      set({ conflicts, conflictCount: conflicts.length });
    } catch (err) {
      captureError(err);
    }
  },

  resolveConflict: async (id, resolution) => {
    if (!dbRef) return;
    await resolveConflictBoundary({
      db: dbRef,
      conflictId: id as SyncConflictId,
      resolution,
    });
    await get().loadConflicts();
  },
}));

export type { SyncConflict } from "./services/sync";
