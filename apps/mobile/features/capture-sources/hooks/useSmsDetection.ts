import { useEffect } from "react";
import { Platform } from "react-native";
import type { AnyDb } from "@/shared/db/client";
import { useCaptureSourcesStore } from "../store";
import { setupSmsDetection } from "./setup";

export function useSmsDetection(db: AnyDb | null, userId: string | null) {
  const refreshDetectedSms = useCaptureSourcesStore((s) => s.refreshDetectedSms);

  useEffect(() => {
    if (Platform.OS !== "ios" || !db || !userId) return;
    return setupSmsDetection(db, userId, refreshDetectedSms);
  }, [db, userId, refreshDetectedSms]);
}
