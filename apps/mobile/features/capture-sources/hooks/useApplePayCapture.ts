import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { setupApplePayCapture } from "./setup";

export function useApplePayCapture(db: AnyDb | null, userId: string | null) {
  useSubscription(
    () => {
      if (!db || !userId) return;
      return setupApplePayCapture(db, userId);
    },
    [db, userId],
    Platform.OS === "ios" && db != null && userId != null
  );
}
