// biome-ignore-all lint/style/useNamingConvention: mock exports must match Sentry API names
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => {
  const scope = {
    setContext: vi.fn(),
    setLevel: vi.fn(),
  };
  return {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    init: vi.fn(),
    scope,
    setUser: vi.fn(),
    withScope: vi.fn(
      (
        callback: (scopeArg: {
          setContext: typeof scope.setContext;
          setLevel: typeof scope.setLevel;
        }) => void
      ) => callback(scope)
    ),
    wrap: vi.fn((component: unknown) => component),
  };
});

vi.mock("@sentry/react-native", () => ({
  init: sentryMocks.init,
  captureException: sentryMocks.captureException,
  captureMessage: sentryMocks.captureMessage,
  setUser: sentryMocks.setUser,
  withScope: sentryMocks.withScope,
  ErrorBoundary: "SentryErrorBoundary",
  wrap: sentryMocks.wrap,
}));

describe("telemetry redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("scrubs sensitive warning context before sending it to Sentry", async () => {
    const { captureWarning } = await import("@/shared/lib/sentry");

    captureWarning("email_capture_failed", {
      rawBodyPreview: "Compra en Farmatodo por $50000 user@example.com",
      authHeader: "Bearer access-token-123",
      recoveryKey: "RK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF",
      signedUrl: "https://storage.example/upload?token=secret-token&signature=abc",
    });

    expect(sentryMocks.scope.setContext).toHaveBeenCalledWith("warning_detail", {
      rawBodyPreview: "[Filtered]",
      authHeader: "Bearer [Filtered]",
      recoveryKey: "[Filtered]",
      signedUrl: "https://storage.example/upload?token=[Filtered]&signature=[Filtered]",
    });
  });

  it("scrubs sensitive exception messages before sending them to Sentry", async () => {
    const { captureError } = await import("@/shared/lib/sentry");

    captureError(
      new Error("Upload failed for RK-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF with Bearer access-token-123")
    );

    const capturedError = sentryMocks.captureException.mock.calls[0]?.[0] as Error;
    expect(capturedError.message).toBe("Upload failed for [Filtered] with Bearer [Filtered]");
  });
});
