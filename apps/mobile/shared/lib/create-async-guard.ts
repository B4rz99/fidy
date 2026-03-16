/**
 * Creates a synchronous mutex guard for preventing concurrent async operations.
 * Use with useRef in React components to protect save buttons from double-tap.
 */
export function createAsyncGuard() {
  let busy = false;
  return {
    tryAcquire: (): boolean => {
      if (busy) return false;
      busy = true;
      return true;
    },
    release: (): void => {
      busy = false;
    },
    isBusy: (): boolean => busy,
  };
}
