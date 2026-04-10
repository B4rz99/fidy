import { useEffect } from "react";
import { AppState } from "react-native";
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { processWidgetTransactions } from "../services/widget-pipeline";

export function useWidgetCapture(db: AnyDb | null, userId: string | null): void {
  useEffect(() => {
    console.log(
      `[useWidgetCapture] Effect triggered. Platform: ${Platform.OS}, hasDb: ${!!db}, hasUserId: ${!!userId}`
    );

    if (Platform.OS !== "ios" || !db || !userId) {
      console.log("[useWidgetCapture] Early return - not iOS or missing deps");
      return;
    }

    const uid = userId as UserId;
    console.log("[useWidgetCapture] Starting initial widget transaction processing");

    processWidgetTransactions(db, uid).catch(function handleInitialError(err) {
      console.error("[useWidgetCapture] Error processing widget transactions:", err);
      captureError(err);
    });

    const subscription = AppState.addEventListener(
      "change",
      function handleAppStateChange(nextState) {
        console.log(`[useWidgetCapture] AppState changed to: ${nextState}`);
        if (nextState !== "active") return;

        console.log("[useWidgetCapture] App became active, processing widget transactions");
        processWidgetTransactions(db, uid).catch(function handleAppStateError(err) {
          console.error("[useWidgetCapture] Error on app state change:", err);
          captureError(err);
        });
      }
    );

    return () => subscription.remove();
  }, [db, userId]);
}
