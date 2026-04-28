import { capturePipelineEvent } from "@/shared/lib";

type OnboardingTelemetryData = Record<string, string | number | boolean>;

export function logOnboardingEvent(event: string, data: OnboardingTelemetryData = {}): void {
  console.info("[onboarding]", event, data);
}

export function captureOnboardingEvent(event: string, data: OnboardingTelemetryData = {}): void {
  capturePipelineEvent({ ...data, source: "onboarding", event });
}

export function trackOnboardingEvent(event: string, data: OnboardingTelemetryData = {}): void {
  logOnboardingEvent(event, data);
  captureOnboardingEvent(event, data);
}
