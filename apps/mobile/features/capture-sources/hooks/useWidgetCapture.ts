import { AppState, Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { createCaptureIngestionPort } from "../services/capture-ingestion";
import { processWidgetTransactions } from "../services/widget-pipeline";

export function useWidgetCapture(db: AnyDb | null, userId: UserId | null): void {
  useSubscription(
    () => {
      if (!db || !userId) {
        return;
      }

      const captureIngestion = createCaptureIngestionPort(db, {
        processWidgetTransactions,
      });

      const ingestWidgetTransactions = () => {
        captureIngestion
          .ingest({ kind: "widget", userId })
          .catch(function handleWidgetCaptureError(err) {
            captureError(err);
          });
      };

      ingestWidgetTransactions();

      const subscription = AppState.addEventListener(
        "change",
        function handleAppStateChange(nextState) {
          if (nextState === "active") {
            ingestWidgetTransactions();
          }
        }
      );

      return () => subscription.remove();
    },
    [db, userId],
    Platform.OS === "ios" && db != null && userId != null
  );
}
