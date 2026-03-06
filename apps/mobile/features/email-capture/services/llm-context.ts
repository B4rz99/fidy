// Infrastructure singleton — module-level `let` is acceptable here
// (stores, hooks, DB clients are exempt per CLAUDE.md)
import { initLlama, type LlamaContext } from "llama.rn";

let contextRef: LlamaContext | null = null;
let initPromise: Promise<LlamaContext> | null = null;

const MODEL_PATH = "qwen3-0.6b-q4_k_m.gguf";

export async function getLlmContext(): Promise<LlamaContext> {
  if (contextRef) return contextRef;
  if (initPromise) return initPromise;

  initPromise = initLlama({
    model: MODEL_PATH,
    n_ctx: 2048,
    n_threads: 4,
  })
    .then((ctx) => {
      contextRef = ctx;
      initPromise = null;
      return ctx;
    })
    .catch((err) => {
      initPromise = null;
      throw err;
    });

  return initPromise;
}

export function releaseLlmContext(): void {
  if (contextRef) {
    contextRef.release?.();
    contextRef = null;
  }
  initPromise = null;
}
