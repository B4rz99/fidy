import { useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { tryGetDb } from "@/shared/db";
import { useSubscription } from "@/shared/hooks";
import { useLocaleStore } from "@/shared/i18n/store";
import { captureError } from "@/shared/lib";
import { formatCleanupMessage } from "../lib/sessions";
import { cleanupExpiredChatSessions } from "../store";

type CleanupDb = NonNullable<ReturnType<typeof tryGetDb>>;
type CleanupUserId = NonNullable<ReturnType<typeof useOptionalUserId>>;
type CleanupContext = readonly [CleanupDb | null, ReturnType<typeof useOptionalUserId>];
type ResolvedCleanupContext = readonly [CleanupDb, CleanupUserId];

function getCleanupDb(userId: ReturnType<typeof useOptionalUserId>): CleanupDb | null {
  return userId ? tryGetDb(userId) : null;
}

function hasCleanupContext(context: CleanupContext): context is ResolvedCleanupContext {
  return Boolean(context[0] && context[1]);
}

function subscribeSessionCleanup(input: {
  readonly db: CleanupDb | null;
  readonly userId: ReturnType<typeof useOptionalUserId>;
  readonly setMessage: (message: string | null) => void;
}) {
  const context = [input.db, input.userId] as const;
  if (!hasCleanupContext(context)) return;
  const [db, userId] = context;

  let active = true;

  void cleanupExpiredChatSessions(db, userId)
    .then((expired) => {
      if (!active) return;
      input.setMessage(formatCleanupMessage(expired.length, useLocaleStore.getState().t));
    })
    .catch(captureError);

  return () => {
    active = false;
  };
}

export function useSessionCleanup() {
  const [message, setMessage] = useState<string | null>(null);
  const userId = useOptionalUserId();
  const db = getCleanupDb(userId);
  const cleanupContext = [db, userId] as const;

  useSubscription(
    () => subscribeSessionCleanup({ db, userId, setMessage }),
    [db, userId],
    hasCleanupContext(cleanupContext)
  );

  const dismiss = useCallback(() => setMessage(null), []);

  return { message, dismiss };
}
