import { Effect } from "effect";
import {
  captureError as captureSentryError,
  capturePipelineEvent as captureSentryPipelineEvent,
  captureWarning as captureSentryWarning,
} from "@/shared/lib/sentry";
import { type BoundAppService, fromThunk, makeAppService } from "./runtime";

export type TelemetryContext = Record<string, string | number | boolean>;

export type AppTelemetry = {
  readonly captureError: (error: unknown) => void | Promise<void>;
  readonly captureWarning: (
    message: string,
    context?: TelemetryContext | undefined
  ) => void | Promise<void>;
  readonly capturePipelineEvent: (data: TelemetryContext) => void | Promise<void>;
};

export const liveAppTelemetry: AppTelemetry = {
  captureError: captureSentryError,
  captureWarning: captureSentryWarning,
  capturePipelineEvent: captureSentryPipelineEvent,
};

export const AppTelemetryService = makeAppService<AppTelemetry>("@/shared/effect/AppTelemetry");

export const captureErrorEffect = (error: unknown) =>
  Effect.flatMap(AppTelemetryService.tag, ({ captureError }) =>
    fromThunk(() => captureError(error))
  );

export const captureWarningEffect = (message: string, context?: TelemetryContext) =>
  Effect.flatMap(AppTelemetryService.tag, ({ captureWarning }) =>
    fromThunk(() => captureWarning(message, context))
  );

export const capturePipelineEventEffect = (data: TelemetryContext) =>
  Effect.flatMap(AppTelemetryService.tag, ({ capturePipelineEvent }) =>
    fromThunk(() => capturePipelineEvent(data))
  );

export function bindAppTelemetry(
  telemetry: AppTelemetry = liveAppTelemetry
): BoundAppService<AppTelemetry, AppTelemetry> {
  return AppTelemetryService.bind(telemetry);
}
