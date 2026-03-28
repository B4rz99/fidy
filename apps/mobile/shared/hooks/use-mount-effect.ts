import { type EffectCallback, useEffect } from "react";

/**
 * Runs the given effect exactly once on mount.
 * Centralizes the biome-ignore for exhaustive-deps so call sites stay clean.
 */
export function useMountEffect(effect: EffectCallback) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design
  useEffect(effect, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only by design
}
