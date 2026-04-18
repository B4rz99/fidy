import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { refreshDetectedSmsCount } from "../store";
import { setupSmsDetection } from "./setup";

export function useSmsDetection(db: AnyDb | null, userId: UserId | null) {
  useSubscription(
    () => {
      if (!db || !userId) return;
      const onRefresh = () => {
        void refreshDetectedSmsCount(db, userId);
      };
      return setupSmsDetection(db, userId, onRefresh).catch((error: unknown) => {
        captureError(error);
        return () => undefined;
      });
    },
    [db, userId],
    Platform.OS === "ios" && db != null && userId != null
  );
}
