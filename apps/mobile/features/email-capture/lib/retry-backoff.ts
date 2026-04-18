import { toIsoDateTime } from "@/shared/lib";
import type { IsoDateTime } from "@/shared/types/branded";

const BACKOFF_MINUTES = [1, 5, 15, 60, 240] as const;
const MAX_RETRIES = 5;

export const computeNextRetryAt = (retryCount: number, now: Date = new Date()): IsoDateTime =>
  toIsoDateTime(
    new Date(
      now.getTime() +
        (BACKOFF_MINUTES[retryCount] ?? BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1] ?? 240) * 60_000
    )
  );

export const isMaxRetriesReached = (retryCount: number): boolean => retryCount >= MAX_RETRIES;
