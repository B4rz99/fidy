import { useQaDevtoolsStore } from "./devtools-store";
import { isLocalQaAvailable } from "./local-session";
import { recordQaLog } from "./logging";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FetchFn = typeof fetch;

let originalFetch: FetchFn | null = null;
let installedFetchWrapper: FetchFn | null = null;

type QaRecordNetworkEvent = ReturnType<typeof useQaDevtoolsStore.getState>["recordNetworkEvent"];

type QaRequestDetails = {
  readonly method: string;
  readonly url: string;
  readonly startedAt: number;
};

function isRequestInput(input: FetchInput): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function getRequestUrl(input: FetchInput) {
  if (typeof input === "string") return input;
  return isRequestInput(input) ? input.url : String(input);
}

function getCurrentFetch(): FetchFn | null {
  return typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null;
}

function setGlobalFetch(nextFetch: FetchFn) {
  globalThis.fetch = nextFetch;
}

function getQaRequestDetails(input: FetchInput, init?: FetchInit): QaRequestDetails {
  return {
    method: getRequestMethod(input, init),
    url: getRequestUrl(input),
    startedAt: Date.now(),
  };
}

function getRequestMethod(input: FetchInput, init?: FetchInit) {
  if (typeof init?.method === "string") return init.method.toUpperCase();
  if (isRequestInput(input)) return input.method.toUpperCase();
  return "GET";
}

function recordBlockedRequest(details: QaRequestDetails, recordNetworkEvent: QaRecordNetworkEvent) {
  recordNetworkEvent({
    method: details.method,
    url: details.url,
    outcome: "blocked",
    status: null,
    durationMs: 0,
    errorMessage: "QA simulateOffline is enabled",
  });
  recordQaLog("warn", "qa_simulate_offline_blocked_request", {
    method: details.method,
    url: details.url,
  });
}

function recordSuccessfulRequest(
  details: QaRequestDetails,
  recordNetworkEvent: QaRecordNetworkEvent,
  response: Response
) {
  recordNetworkEvent({
    method: details.method,
    url: details.url,
    outcome: "success",
    status: response.status,
    durationMs: Date.now() - details.startedAt,
    errorMessage: null,
  });
}

function recordFailedRequest(
  details: QaRequestDetails,
  recordNetworkEvent: QaRecordNetworkEvent,
  error: unknown
) {
  const errorMessage = error instanceof Error ? error.message : "unknown";
  recordNetworkEvent({
    method: details.method,
    url: details.url,
    outcome: "error",
    status: null,
    durationMs: Date.now() - details.startedAt,
    errorMessage,
  });
}

async function inspectFetchRequest(currentFetch: FetchFn, input: FetchInput, init?: FetchInit) {
  const { flags, recordNetworkEvent } = useQaDevtoolsStore.getState();
  const requestDetails = getQaRequestDetails(input, init);

  if (flags.simulateOffline) {
    recordBlockedRequest(requestDetails, recordNetworkEvent);
    throw new TypeError("Network request failed (QA simulateOffline)");
  }

  try {
    const response = await currentFetch(input, init);
    recordSuccessfulRequest(requestDetails, recordNetworkEvent, response);
    return response;
  } catch (error) {
    recordFailedRequest(requestDetails, recordNetworkEvent, error);
    throw error;
  }
}

function createQaFetchWrapper(currentFetch: FetchFn): FetchFn {
  return ((input: FetchInput, init?: FetchInit) =>
    inspectFetchRequest(currentFetch, input, init)) as FetchFn;
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
  installedFetchWrapper = createQaFetchWrapper(currentFetch);

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
