import { useQaDevtoolsStore } from "./devtools-store";
import { isLocalQaAvailable } from "./local-session";
import { recordQaLog } from "./logging";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FetchFn = typeof fetch;

let originalFetch: FetchFn | null = null;
let installedFetchWrapper: FetchFn | null = null;

function getRequestUrl(input: FetchInput) {
  if (typeof input === "string") return input;
  if (typeof URL !== "undefined" && input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

function getRequestMethod(input: FetchInput, init?: FetchInit) {
  if (typeof init?.method === "string") return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function getCurrentFetch(): FetchFn | null {
  return typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null;
}

function setGlobalFetch(nextFetch: FetchFn) {
  globalThis.fetch = nextFetch;
}

export function installQaFetchInspector() {
  if (!isLocalQaAvailable()) {
    return () => undefined;
  }

  if (installedFetchWrapper) {
    return () => undefined;
  }

  const currentFetch = getCurrentFetch();
  if (!currentFetch) {
    return () => undefined;
  }

  originalFetch = currentFetch;
  installedFetchWrapper = (async (input: FetchInput, init?: FetchInit) => {
    const { flags, recordNetworkEvent } = useQaDevtoolsStore.getState();
    const url = getRequestUrl(input);
    const method = getRequestMethod(input, init);
    const startedAt = Date.now();

    if (flags.simulateOffline) {
      recordNetworkEvent({
        method,
        url,
        outcome: "blocked",
        status: null,
        durationMs: 0,
        errorMessage: "QA simulateOffline is enabled",
      });
      recordQaLog("warn", "qa_simulate_offline_blocked_request", { method, url });
      throw new TypeError("Network request failed (QA simulateOffline)");
    }

    try {
      const response = await currentFetch(input, init);

      recordNetworkEvent({
        method,
        url,
        outcome: "success",
        status: response.status,
        durationMs: Date.now() - startedAt,
        errorMessage: null,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "unknown";

      recordNetworkEvent({
        method,
        url,
        outcome: "error",
        status: null,
        durationMs: Date.now() - startedAt,
        errorMessage,
      });

      throw error;
    }
  }) as FetchFn;

  setGlobalFetch(installedFetchWrapper);
  recordQaLog("info", "qa_fetch_inspector_installed");

  return () => {
    if (originalFetch) {
      setGlobalFetch(originalFetch);
    }
    installedFetchWrapper = null;
    originalFetch = null;
  };
}
