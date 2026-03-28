import { useRef, useState } from "react";
import { useTransactionStore } from "@/features/transactions";
import { AppState } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { getSupabase } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { captureWarning } from "@/shared/lib";
import { isOnline, onConnectivityChange } from "../services/networkMonitor";
import { fullSync } from "../services/syncEngine";
import { useSyncConflictStore } from "../store";

export function useSync(db: AnyDb | null, userId: string | null): boolean {
  const isSyncing = useRef(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  useSubscription(
    () => {
      if (!db || !userId) return;

      setInitialSyncDone(false);
      const supabase = getSupabase();
      const hasCompletedInitialRun = { current: false };

      const markInitialDone = () => {
        if (!hasCompletedInitialRun.current) {
          hasCompletedInitialRun.current = true;
          setInitialSyncDone(true);
        }
      };

      const runSync = async () => {
        if (isSyncing.current) return;
        const online = await isOnline();
        if (!online) return;
        isSyncing.current = true;
        try {
          const pullOk = await fullSync(db, supabase, userId);
          await useTransactionStore.getState().refresh();
          useSyncConflictStore.getState().loadConflicts();
          if (pullOk) markInitialDone();
        } catch (error) {
          captureWarning("background_sync_failed", {
            errorType: error instanceof Error ? error.message : "unknown",
          });
        } finally {
          isSyncing.current = false;
        }
      };

      void runSync();

      const appStateSubscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void runSync();
      });

      const unsubscribeNet = onConnectivityChange((connected) => {
        if (connected) void runSync();
      });

      return () => {
        appStateSubscription.remove();
        unsubscribeNet();
      };
    },
    [db, userId],
    db != null && userId != null
  );

  return initialSyncDone;
}
