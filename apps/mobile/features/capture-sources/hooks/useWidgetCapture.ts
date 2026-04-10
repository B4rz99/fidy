import { useEffect } from "react";
import { AppState } from "react-native";
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { processWidgetTransactions } from "../services/widget-pipeline";

export function useWidgetCapture(db: AnyDb | null, userId: string | null) {
  useEffect(() => {
    if (Platform.OS !== "ios" || !db || !userId) return;

    const uid = userId as UserId;

    processWidgetTransactions(db, uid).catch(captureError);

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        processWidgetTransactions(db, uid).catch(captureError);
      }
    });

    return () => subscription.remove();
  }, [db, userId]);
}
