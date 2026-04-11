import { useEffect } from "react";
import { AppState } from "react-native";
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { processWidgetTransactions } from "../services/widget-pipeline";

export function useWidgetCapture(db: AnyDb | null, userId: string | null): void {
  useEffect(() => {
    if (Platform.OS !== "ios" || !db || !userId) {
      return;
    }

    const uid = userId as UserId;

    processWidgetTransactions(db, uid).catch(function handleInitialError(err) {
      captureError(err);
    });

    const subscription = AppState.addEventListener(
      "change",
      function handleAppStateChange(nextState) {
        if (nextState !== "active") return;

        processWidgetTransactions(db, uid).catch(function handleAppStateError(err) {
          captureError(err);
        });
      }
    );

    return () => subscription.remove();
  }, [db, userId]);
}
