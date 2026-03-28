import { useEffect } from "react";

/**
 * Manages a subscription lifecycle — calls `subscribe` when deps are met,
 * and runs the returned cleanup function on unmount or dep change.
 *
 * Handles the common async-setup pattern where setup returns a teardown
 * function, but the component may unmount before setup completes.
 *
 * @param subscribe — Called when `enabled` is true. Return a cleanup function or void.
 *   May return a Promise<cleanup> for async setup patterns.
 * @param deps — React dependency array for re-subscribing.
 * @param enabled — Guard condition; subscription only runs when true. Defaults to true.
 */
export function useSubscription(
  subscribe: () => void | (() => void) | Promise<() => void>,
  deps: readonly unknown[],
  enabled = true
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: caller controls deps
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let syncCleanup: (() => void) | undefined;

    const result = subscribe();

    if (result instanceof Promise) {
      result
        .then((teardown) => {
          if (cancelled) {
            teardown();
          } else {
            syncCleanup = teardown;
          }
        })
        .catch(() => {
          // Subscriber is responsible for its own error handling.
          // Swallow here to prevent unhandled rejection.
        });
    } else if (typeof result === "function") {
      syncCleanup = result;
    }

    return () => {
      cancelled = true;
      syncCleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe is intentionally excluded; callers manage deps via spread
  }, [enabled, ...deps]);
}
