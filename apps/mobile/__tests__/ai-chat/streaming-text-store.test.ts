import { describe, expect, it, vi } from "vitest";
import { createStreamingTextStore } from "@/features/ai-chat/services/streaming-text-store";

describe("streaming text store", () => {
  it("notifies subscribers when streaming text changes", () => {
    const store = createStreamingTextStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.set("hello");

    expect(store.getSnapshot()).toBe("hello");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.set("ignored");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears the streaming text", () => {
    const store = createStreamingTextStore("partial");

    store.clear();

    expect(store.getSnapshot()).toBe("");
  });
});
