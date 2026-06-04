import { afterEach, describe, expect, it, vi } from "vitest";
import { runAfterNavigationTransition } from "@/shared/lib/navigation-transition";

describe("runAfterNavigationTransition", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs after a matching transitionEnd event and unsubscribes", () => {
    const callback = vi.fn<() => void>();
    const unsubscribe = vi.fn<() => void>();
    let listener = (_event: { data?: { closing?: boolean } }) => {};
    const navigation = {
      addListener: vi.fn((_event: "transitionEnd", nextListener: typeof listener) => {
        listener = nextListener;
        return unsubscribe;
      }),
    };

    runAfterNavigationTransition(navigation, callback, { closing: false, fallbackMs: null });
    listener({ data: { closing: true } });
    expect(callback).not.toHaveBeenCalled();

    listener({ data: { closing: false } });
    expect(callback).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("uses the fallback timer when transition events are unavailable", () => {
    vi.useFakeTimers();
    const callback = vi.fn<() => void>();

    runAfterNavigationTransition({}, callback, { fallbackMs: 10 });
    vi.advanceTimersByTime(10);

    expect(callback).toHaveBeenCalledOnce();
  });

  it("cancels pending fallback work", () => {
    vi.useFakeTimers();
    const callback = vi.fn<() => void>();

    const transition = runAfterNavigationTransition(null, callback, { fallbackMs: 10 });
    transition.cancel();
    vi.advanceTimersByTime(10);

    expect(callback).not.toHaveBeenCalled();
  });
});
