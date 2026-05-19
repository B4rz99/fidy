export type StreamingTextStore = {
  readonly getSnapshot: () => string;
  readonly set: (content: string) => void;
  readonly clear: () => void;
  readonly subscribe: (listener: () => void) => () => void;
};

export function createStreamingTextStore(initialContent = ""): StreamingTextStore {
  let content = initialContent;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => content,
    set: (nextContent) => {
      content = nextContent;
      listeners.forEach((listener) => listener());
    },
    clear: () => {
      content = "";
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
