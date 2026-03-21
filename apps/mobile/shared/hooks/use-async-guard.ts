import { useCallback, useRef, useState } from "react";
import { createAsyncGuard } from "./create-async-guard";

/**
 * React hook wrapping createAsyncGuard with reactive state for UI feedback.
 * Prevents concurrent execution of an async callback and exposes `isBusy`
 * for disabling buttons / dimming UI during the operation.
 */
export function useAsyncGuard() {
  const guardRef = useRef<ReturnType<typeof createAsyncGuard> | null>(null);
  if (!guardRef.current) guardRef.current = createAsyncGuard();
  const guard = guardRef.current;

  const [isBusy, setIsBusy] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (!guard.tryAcquire()) return;
      setIsBusy(true);
      try {
        await fn();
      } finally {
        guard.release();
        setIsBusy(false);
      }
    },
    [guard]
  );

  return { isBusy, run } as const;
}
