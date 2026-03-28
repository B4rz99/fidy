import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import { useCaptureSourcesStore } from "../store";
import { setupNotificationCapture } from "./setup";

export function useNotificationCapture(db: AnyDb | null, userId: string | null) {
  const enabledPackages = useCaptureSourcesStore((s) => s.enabledPackages);

  useSubscription(
    () => {
      if (!db || !userId) return;
      return setupNotificationCapture(db, userId, enabledPackages).catch((error) => {
        captureError(error);
        return () => {};
      });
    },
    [db, userId, enabledPackages],
    Platform.OS === "android" && db != null && userId != null && enabledPackages.length > 0
  );
}
