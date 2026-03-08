import { useEffect } from "react";
import { Platform } from "react-native";
import type { AnyDb } from "@/shared/db/client";
import { setupApplePayCapture } from "./setup";

export function useApplePayCapture(db: AnyDb | null, userId: string | null) {
  useEffect(() => {
    if (Platform.OS !== "ios" || !db || !userId) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    setupApplePayCapture(db, userId).then((teardown) => {
      if (cancelled) {
        teardown();
      } else {
        cleanup = teardown;
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [db, userId]);
}
