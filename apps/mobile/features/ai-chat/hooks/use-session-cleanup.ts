import { useCallback, useState } from "react";
import { useMountEffect } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n/store";
import { formatCleanupMessage } from "../lib/sessions";
import { useChatStore } from "../store";

export function useSessionCleanup() {
  const [message, setMessage] = useState<string | null>(null);
  const cleanupExpiredSessions = useChatStore((s) => s.cleanupExpiredSessions);

  useMountEffect(() => {
    cleanupExpiredSessions().then((expired) => {
      setMessage(formatCleanupMessage(expired.length, useLocaleStore.getState().t));
    });
  });

  const dismiss = useCallback(() => setMessage(null), []);

  return { message, dismiss };
}
