import { useEffect } from "react";
import { AppState } from "react-native";
import { processWidgetTransactions } from "@/features/capture-sources/services/widget-pipeline";
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { createCaptureIngestionPort } from "../services/capture-ingestion";

export function useWidgetCapture(db: AnyDb | null, userId: string | null): void {
  useEffect(() => {
    if (Platform.OS !== "ios" || !db || !userId) {
      return;
    }

    const uid = userId as UserId;
    const captureIngestion = createCaptureIngestionPort(db, {
      processWidgetTransactions,
    });

    captureIngestion
      .ingest({ kind: "widget", userId: uid })
      .catch(function handleInitialError(err) {
        captureError(err);
      });

    const subscription = AppState.addEventListener(
      "change",
      function handleAppStateChange(nextState) {
        if (nextState !== "active") return;

        captureIngestion
          .ingest({ kind: "widget", userId: uid })
          .catch(function handleAppStateError(err) {
            captureError(err);
          });
      }
    );

    return () => subscription.remove();
  }, [db, userId]);
}
