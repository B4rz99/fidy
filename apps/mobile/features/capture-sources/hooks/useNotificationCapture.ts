import { useEffect } from "react";
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import { useCaptureSourcesStore } from "../store";
import { setupNotificationCapture } from "./setup";

export function useNotificationCapture(db: AnyDb | null, userId: string | null) {
  const enabledPackages = useCaptureSourcesStore((s) => s.enabledPackages);

  useEffect(() => {
    if (Platform.OS !== "android" || !db || !userId || enabledPackages.length === 0) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setupNotificationCapture(db, userId, enabledPackages)
      .then((c) => {
        if (cancelled) {
          c();
        } else {
          cleanup = c;
        }
      })
      .catch(captureError);
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [db, userId, enabledPackages]);
}
