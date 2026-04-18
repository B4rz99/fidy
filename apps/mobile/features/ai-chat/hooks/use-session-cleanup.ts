import { useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import { tryGetDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n/store";
import { captureError } from "@/shared/lib";
import { formatCleanupMessage } from "../lib/sessions";
import { cleanupExpiredChatSessions } from "../store";

export function useSessionCleanup() {
  const [message, setMessage] = useState<string | null>(null);
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  useSubscription(
    () => {
      if (!db || !userId) return;

      let active = true;

      void cleanupExpiredChatSessions(db, userId)
        .then((expired) => {
          if (!active) return;
          setMessage(formatCleanupMessage(expired.length, useLocaleStore.getState().t));
        })
        .catch(captureError);

      return () => {
        active = false;
      };
    },
    [db, userId],
    Boolean(db && userId)
  );

  const dismiss = useCallback(() => setMessage(null), []);

  return { message, dismiss };
}
