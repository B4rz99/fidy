import { useEffect } from "react";
import { Platform } from "react-native";
import type { AnyDb } from "@/shared/db/client";
import { setupApplePayCapture } from "./setup";

export function useApplePayCapture(db: AnyDb | null, userId: string | null) {
  useEffect(() => {
    if (Platform.OS !== "ios" || !db || !userId) return;
    return setupApplePayCapture(db, userId);
  }, [db, userId]);
}
