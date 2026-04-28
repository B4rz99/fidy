import * as Sentry from "@sentry/react-native";

export function initSentry(dsn: string): void {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    profilesSampleRate: 0,
    environment: __DEV__ ? "development" : "production",
    beforeSend: (event) => sanitizeTelemetryValue(event) as typeof event,
  });
}

export function captureError(error: unknown): void {
  Sentry.captureException(sanitizeError(error));
}

export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null);
}

export function capturePipelineEvent(data: Record<string, string | number | boolean>): void {
  Sentry.withScope((scope) => {
    scope.setContext("pipeline", sanitizeTelemetryRecord(data));
    scope.setLevel("info");
    Sentry.captureMessage(`pipeline:${String(data.source)}`);
  });
}

export function captureWarning(
  message: string,
  context?: Record<string, string | number | boolean>
): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("warning_detail", sanitizeTelemetryRecord(context));
    }
    scope.setLevel("warning");
    Sentry.captureMessage(message);
  });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const wrapWithSentry = Sentry.wrap;

const FILTERED = "[Filtered]";

const SENSITIVE_KEY_FRAGMENTS = [
  "auth",
  "body",
  "email",
  "notification",
  "rawbody",
  "recoverykey",
  "recovery_key",
  "subject",
  "text",
  "token",
] as const;

const sanitizeError = (error: unknown): unknown => {
  if (!(error instanceof Error)) {
    return sanitizeTelemetryValue(error);
  }

  const sanitized = new Error(sanitizeString(error.message));
  sanitized.name = error.name;
  sanitized.stack = error.stack ? sanitizeString(error.stack) : error.stack;
  return sanitized;
};

const sanitizeTelemetryRecord = <T extends Record<string, unknown>>(record: T): T => {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, sanitizeTelemetryEntry(key, value)])
  ) as T;
};

const sanitizeTelemetryValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeTelemetryValue);
  }

  if (typeof value === "object" && value !== null) {
    return sanitizeTelemetryRecord(value as Record<string, unknown>);
  }

  return value;
};

const sanitizeTelemetryEntry = (key: string, value: unknown): unknown => {
  if (typeof value === "string" && isSensitiveKey(key)) {
    return key.toLowerCase().includes("auth") ? sanitizeString(value) : FILTERED;
  }

  return sanitizeTelemetryValue(value);
};

const isSensitiveKey = (key: string): boolean => {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
};

const sanitizeString = (value: string): string => {
  return value
    .replace(/RK-(?:[0-9A-F]{4}-){5}[0-9A-F]{4}/giu, FILTERED)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gu, `Bearer ${FILTERED}`)
    .replace(/([?&](?:access_token|refresh_token|signature|token)=)[^&#\s]+/giu, `$1${FILTERED}`)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, FILTERED);
};
