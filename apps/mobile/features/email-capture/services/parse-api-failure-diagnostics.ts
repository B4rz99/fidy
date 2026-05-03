type ParseApiFailureResponse = {
  readonly data?: { readonly error?: string } | null;
  readonly error?: {
    readonly message?: string;
    readonly context?: unknown;
  } | null;
};

const RETRY_AFTER_HEADER = "Retry-After";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getContext = (response: ParseApiFailureResponse): Record<string, unknown> | null =>
  isRecord(response.error?.context) ? response.error.context : null;

const readHttpStatus = (response: ParseApiFailureResponse): number | undefined => {
  const status = getContext(response)?.status;
  return typeof status === "number" ? status : undefined;
};

const readRetryAfterSeconds = (response: ParseApiFailureResponse): number | undefined => {
  const headers = getContext(response)?.headers;
  if (!isRecord(headers) || typeof headers.get !== "function") return undefined;
  const value = headers.get.call(headers, RETRY_AFTER_HEADER);
  if (typeof value !== "string") return undefined;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
};

const getParseApiErrorMessage = (response: ParseApiFailureResponse): string => {
  if (readHttpStatus(response) === 429) return "rate_limited";
  return response.error?.message ?? response.data?.error ?? "unknown";
};

export function buildParseApiFailureDiagnostics(response: ParseApiFailureResponse) {
  const httpStatus = readHttpStatus(response);
  const retryAfterSeconds = readRetryAfterSeconds(response);
  return {
    errorMessage: getParseApiErrorMessage(response),
    hasData: response.data != null,
    ...(httpStatus == null ? {} : { httpStatus }),
    ...(retryAfterSeconds == null ? {} : { retryAfterSeconds }),
  };
}
