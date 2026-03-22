import * as Sentry from "@sentry/react-native";

export function initSentry(dsn: string): void {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    profilesSampleRate: 0,
    environment: __DEV__ ? "development" : "production",
  });
}

export function captureError(error: unknown): void {
  Sentry.captureException(error);
}

export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null);
}

export function capturePipelineEvent(data: Record<string, string | number | boolean>): void {
  Sentry.withScope((scope) => {
    scope.setContext("pipeline", data);
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
      scope.setContext("warning_detail", context);
    }
    scope.setLevel("warning");
    Sentry.captureMessage(message);
  });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const wrapWithSentry = Sentry.wrap;
