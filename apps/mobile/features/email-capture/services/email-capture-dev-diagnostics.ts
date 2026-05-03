import type { TelemetryContext } from "@/shared/effect/telemetry";

export function logEmailCaptureDevDiagnostic(name: string, context: TelemetryContext): void {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;

  console.info(`[email-capture] ${name}`, context);
}
