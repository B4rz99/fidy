import { Effect } from "effect";
import { toIsoDateTime } from "@/shared/lib";
import type { IsoDateTime } from "@/shared/types/branded";
import { type BoundAppService, fromSync, makeAppService } from "./runtime";

export type AppClock = {
  readonly now: () => Date;
  readonly nowIsoDateTime: () => IsoDateTime;
};

export const liveAppClock: AppClock = {
  now: () => new Date(),
  nowIsoDateTime: () => toIsoDateTime(new Date()),
};

export const AppClockService = makeAppService<AppClock>("@/shared/effect/AppClock");

export const currentDateEffect = Effect.flatMap(AppClockService.tag, ({ now }) => fromSync(now));

export const currentIsoDateTimeEffect = Effect.flatMap(AppClockService.tag, ({ nowIsoDateTime }) =>
  fromSync(nowIsoDateTime)
);

export function bindAppClock(clock: AppClock = liveAppClock): BoundAppService<AppClock, AppClock> {
  return AppClockService.bind(clock);
}
