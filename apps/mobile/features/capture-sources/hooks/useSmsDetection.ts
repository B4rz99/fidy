import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import { useCaptureSourcesStore } from "../store";
import { setupSmsDetection } from "./setup";

export function useSmsDetection(db: AnyDb | null, userId: string | null) {
  const refreshDetectedSms = useCaptureSourcesStore((s) => s.refreshDetectedSms);

  useSubscription(
    () => {
      if (!db || !userId) return;
      let cleanup: (() => void) | undefined;
      const onRefresh = () => {
        void refreshDetectedSms();
      };
      setupSmsDetection(db, userId, onRefresh)
        .then((fn) => {
          cleanup = fn;
        })
        .catch((error: unknown) => {
          captureError(error);
        });
      return () => cleanup?.();
    },
    [db, userId, refreshDetectedSms],
    Platform.OS === "ios" && db != null && userId != null
  );
}
