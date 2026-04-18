import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import type { SyncConflictId } from "@/shared/types/branded";
import {
  listConflicts,
  resolveConflict as resolveConflictBoundary,
  type SyncConflict,
} from "./services/sync";

type SyncConflictState = {
  conflicts: SyncConflict[];
  conflictCount: number;
};

type SyncConflictActions = {
  setConflicts: (conflicts: readonly SyncConflict[]) => void;
};

export const useSyncConflictStore = create<SyncConflictState & SyncConflictActions>((set) => ({
  conflicts: [],
  conflictCount: 0,

  setConflicts: (conflicts) => {
    set({ conflicts: [...conflicts], conflictCount: conflicts.length });
  },
}));

export async function loadSyncConflicts(db: AnyDb): Promise<void> {
  try {
    const conflicts = [...(await listConflicts({ db }))];
    useSyncConflictStore.getState().setConflicts(conflicts);
  } catch (err) {
    captureError(err);
  }
}

export async function resolveSyncConflictSelection(
  db: AnyDb,
  id: string,
  resolution: "local" | "server"
): Promise<void> {
  await resolveConflictBoundary({
    db,
    conflictId: id as SyncConflictId,
    resolution,
  });
  await loadSyncConflicts(db);
}

export type { SyncConflict } from "./services/sync";
