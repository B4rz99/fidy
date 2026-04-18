import { useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import { tryGetDb } from "@/shared/db";
import { useMountEffect } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n/store";
import { formatCleanupMessage } from "../lib/sessions";
import { cleanupExpiredChatSessions } from "../store";

export function useSessionCleanup() {
  const [message, setMessage] = useState<string | null>(null);
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  useMountEffect(() => {
    if (!db || !userId) return;
    void cleanupExpiredChatSessions(db, userId).then((expired) => {
      setMessage(formatCleanupMessage(expired.length, useLocaleStore.getState().t));
    });
  });

  const dismiss = useCallback(() => setMessage(null), []);

  return { message, dismiss };
}
