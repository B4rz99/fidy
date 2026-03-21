import { useEffect } from "react";
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import { useCaptureSourcesStore } from "../store";
import { setupSmsDetection } from "./setup";

export function useSmsDetection(db: AnyDb | null, userId: string | null) {
  const refreshDetectedSms = useCaptureSourcesStore((s) => s.refreshDetectedSms);

  useEffect(() => {
    if (Platform.OS !== "ios" || !db || !userId) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    setupSmsDetection(db, userId, refreshDetectedSms)
      .then((teardown) => {
        if (cancelled) {
          teardown();
        } else {
          cleanup = teardown;
        }
      })
      .catch(captureError);

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [db, userId, refreshDetectedSms]);
}
