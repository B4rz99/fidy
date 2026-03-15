import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useTransactionStore } from "@/features/transactions/store";
import type { AnyDb } from "@/shared/db/client";
import { getSupabase } from "@/shared/db/supabase";
import { isOnline, onConnectivityChange } from "../services/networkMonitor";
import { fullSync } from "../services/syncEngine";
import { useSyncConflictStore } from "../store";

export function useSync(db: AnyDb | null, userId: string | null) {
  const isSyncing = useRef(false);

  useEffect(() => {
    if (!db || !userId) return;

    const supabase = getSupabase();

    const runSync = async () => {
      if (isSyncing.current) return;
      const online = await isOnline();
      if (!online) return;
      isSyncing.current = true;
      try {
        await fullSync(db, supabase, userId);
        await useTransactionStore.getState().refresh();
        useSyncConflictStore.getState().loadConflicts();
      } catch (error) {
        console.warn("[sync] background sync failed:", error);
      } finally {
        isSyncing.current = false;
      }
    };

    runSync();

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") runSync();
    });

    const unsubscribeNet = onConnectivityChange((connected) => {
      if (connected) runSync();
    });

    return () => {
      appStateSubscription.remove();
      unsubscribeNet();
    };
  }, [db, userId]);
}
