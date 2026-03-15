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

export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const wrapWithSentry = Sentry.wrap;
