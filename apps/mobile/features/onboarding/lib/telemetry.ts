import { capturePipelineEvent } from "@/shared/lib";

type OnboardingTelemetryData = Record<string, string | number | boolean>;

export function logOnboardingEvent(_event: string, _data: OnboardingTelemetryData = {}): void {}

function captureOnboardingEvent(event: string, data: OnboardingTelemetryData = {}): void {
  capturePipelineEvent({ ...data, source: "onboarding", event });
}

export function trackOnboardingEvent(event: string, data: OnboardingTelemetryData = {}): void {
  captureOnboardingEvent(event, data);
}
