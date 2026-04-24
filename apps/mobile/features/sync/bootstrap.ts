import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext, SyncBootstrapContext } from "@/shared/bootstrap/types";
import { loadSyncConflicts, useSync } from "./public";

export const syncBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "sync",
  run: ({ db }) => {
    void loadSyncConflicts(db);
  },
};

export const useSyncBootstrap = ({
  db,
  enableRemoteEffects,
  migrationsReady,
  userId,
}: SyncBootstrapContext): boolean =>
  useSync(enableRemoteEffects && migrationsReady ? db : null, enableRemoteEffects ? userId : null);
