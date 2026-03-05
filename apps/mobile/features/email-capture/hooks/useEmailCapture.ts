import { useEffect } from "react";
import { AppState } from "react-native";
import type { AnyDb } from "@/shared/db/client";
import { useEmailCaptureStore } from "../store";

export function useEmailCapture(db: AnyDb | null, userId: string | null) {
  useEffect(() => {
    if (!db || !userId) return;

    useEmailCaptureStore.getState().initStore(db, userId);

    const runFetch = () => {
      useEmailCaptureStore
        .getState()
        .fetchAndProcess("", "")
        .catch(() => {});
    };

    useEmailCaptureStore
      .getState()
      .loadAccounts()
      .then(() => runFetch())
      .catch(() => {});

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") runFetch();
    });

    return () => {
      subscription.remove();
    };
  }, [db, userId]);
}
