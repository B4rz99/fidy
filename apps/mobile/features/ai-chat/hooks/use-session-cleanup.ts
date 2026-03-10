import { useCallback, useEffect, useState } from "react";
import { formatCleanupMessage } from "../lib/sessions";
import { useChatStore } from "../store";

export function useSessionCleanup() {
  const [message, setMessage] = useState<string | null>(null);
  const cleanupExpiredSessions = useChatStore((s) => s.cleanupExpiredSessions);

  useEffect(() => {
    cleanupExpiredSessions().then((expired) => {
      setMessage(formatCleanupMessage(expired.length));
    });
  }, [cleanupExpiredSessions]);

  const dismiss = useCallback(() => setMessage(null), []);

  return { message, dismiss };
}
